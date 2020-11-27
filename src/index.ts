
import * as _ from 'lodash'
import * as async from 'async'
import { linkCheck } from 'link-check/src'
import * as ProgressBar from 'progress'

import { MarkdownLinkCheckOptions, LinkCheckResult, Callback } from './types'

export function markdownLinkCheck(markdown: string, optionArg: Options | Callback, callbackArg?: Callback): void {
    let options: Options
    let callback: Callback

    if (arguments.length === 2 && typeof optionArg === 'function') {
        // optional 'opts' not supplied.
        callback = optionArg as Callback
        options = {}
    } else {
        callback = callbackArg!
        options = optionArg as Options
    }

    if(!options.ignoreDisable) {
        markdown = [
            /(<!--[ \t]+markdown-link-check-disable[ \t]+-->[\S\s]*?<!--[ \t]+markdown-link-check-enable[ \t]+-->)/mg,
            /(<!--[ \t]+markdown-link-check-disable[ \t]+-->[\S\s]*(?!<!--[ \t]+markdown-link-check-enable[ \t]+-->))/mg,
            /(<!--[ \t]+markdown-link-check-disable-next-line[ \t]+-->\r?\n[^\r\n]*)/mg,
            /([^\r\n]*<!--[ \t]+markdown-link-check-disable-line[ \t]+-->[^\r\n]*)/mg
        ].reduce((_markdown, disablePattern) => {
            return _markdown.replace(new RegExp(disablePattern), '');
        }, markdown);
    }

    const linksCollection: string[] = _.uniq(markdownLinkExtractor(markdown));
    const bar = (options.showProgressBar) ?
        new ProgressBar('Checking... [:bar] :percent', {
            complete: '=',
            incomplete: ' ',
            width: 25,
            total: linksCollection.length
        }) : undefined;

    async.mapLimit(linksCollection, 2, (link, callback) => {
        if (options.ignorePatterns) {
            const shouldIgnore = options.ignorePatterns.some( (ignorePattern) => {
                return ignorePattern.pattern instanceof RegExp ? ignorePattern.pattern.test(link) : (new RegExp(ignorePattern.pattern)).test(link) ? true : false;
            });

            if (shouldIgnore) {
                const result = LinkCheckResult.fromStatus(options, link, 0, undefined);
                result.status = 'ignored'; // custom status for ignored links
                callback(null, result);
                return;
            }
        }

        if (options.replacementPatterns) {
            for (const replacementPattern of options.replacementPatterns) {
                const pattern = replacementPattern.pattern instanceof RegExp ? replacementPattern.pattern : new RegExp(replacementPattern.pattern);
                link = link.replace(pattern, replacementPattern.replacement);
            }
        }

        // Make sure it is not undefined and that the appropriate headers are always recalculated for a given link.
        options.headers = {};

        if (options.httpHeaders) {
            for (const httpHeader of options.httpHeaders) {
                for (const url of httpHeader.urls) {
                    if (link.startsWith(url)) {
                        Object.assign(options.headers, httpHeader.headers);

                        // The headers of this httpHeader has been applied, the other URLs of this httpHeader don't need to be evaluated any further.
                        break;
                    }
                }
            }
        }

        linkCheck(link, options, (err, result) => {

            if (bar) {
                bar.tick();
            }

            if (err) {
                result = new LinkCheckResult(opts, link, 500, err);
                result.status = 'error'; // custom status for errored links
            }

            callback(null, result);
        });
    }, callback);
}
