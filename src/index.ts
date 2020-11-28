
import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'
import * as async from 'async'
import * as request from 'request'
import * as _ from 'lodash'
import { linkCheck, LinkCheckResult, Options as LinkCheckOptions } from 'link-check'
import ProgressBar = require('progress')
import markdownLinkExtractor = require('markdown-link-extractor')
import { Options, Status, Callback } from './types'

export * from './types'

interface ProcessInputResults {
    filenameOrUrl: string
    options: Options
    results?: (LinkCheckResult | undefined)[]
}
export interface InputsArgs {
    inputs: InputArgs[]
}
export interface InputArgs {
    filenameOrUrl: string
    fileEncoding?: string
}

/**
 * 
 * Inputs: list of filenameOrUrl
 * Outputs: for each filenameOrUrl{
 *  filenameOrUrl
 *  list of links and their status
 * }
 */
export function processInputs(
    inputsArgs: InputsArgs,
    options: Options,
    callback: (err: any, results?: (ProcessInputResults | undefined)[]) => void,
): void {
    const globalFileEncoding = options.fileEncoding

    const inputArgs: InputArg[] = inputsArgs.inputs.map(input => {
        const inputOptions: Options = {}
        Object.assign(inputOptions, options)
        inputOptions.fileEncoding = input.fileEncoding || globalFileEncoding || 'utf-8'
        return {
            filenameOrUrl: input.filenameOrUrl,
            options: inputOptions,
        }
    })

    async.mapLimit(
        inputArgs /*arr*/,
        2 /* limit */,
        processInput /*iterator*/,
        callback /*callback*/)
}

interface InputArg {
    filenameOrUrl: string
    options: Options,
}

/**
 * 
 * Inputs: a filenameOrUrl
 * Outputs: {
 *  filenameOrUrl
 *  list of links and their status
 * }
 */
function processInput(
    inputArg: InputArg,
    callback: (err: any, results?: ProcessInputResults) => void,
) {
    extractMarkdownFromInput(inputArg, (err1: any, result?: ExtractMarkdownResult) => {
        if (err1) {
            callback(err1)
        } else {
            procesMarkdown(result!.markdown, result!.options, (err2: any, results?: (LinkCheckResult | undefined)[]) => {
                if (err2) {
                    callback(err2)
                } else {
                    callback(null, {
                        filenameOrUrl: inputArg.filenameOrUrl,
                        options: result!.options,
                        results,
                    })
                }
            })
        }
    })
}


interface InputArg {
    filenameOrUrl: string
    options: Options,
}
interface ExtractMarkdownResult {
    filenameOrUrl: string
    markdown: string,
    options: Options,
}

function extractMarkdownFromInput(
    inputArg: InputArg,
    callback: (err: any, result?: ExtractMarkdownResult) => void,
) {
    const filenameOrUrl = inputArg.filenameOrUrl
    if (/https?:/.test(filenameOrUrl)) {
        request.get(filenameOrUrl, (error: any, response: request.Response, body: any): void => {
            if (error) {
                callback(error)
            }
            else if (response.statusCode === 404) {
                callback(new Error(`Error: 404 - not found for URL ${filenameOrUrl}. Please provide a valid URL as an argument.`))
            }

            let baseUrl
            try { // extract baseUrl from supplied URL
                const parsed = url.parse(filenameOrUrl);
                parsed.search = null
                parsed.hash = null
                if (parsed.pathname && parsed.pathname.lastIndexOf('/') !== -1) {
                    parsed.pathname = parsed.pathname.substr(0, parsed.pathname.lastIndexOf('/') + 1);
                }
                baseUrl = url.format(parsed);
            } catch (err) { /* ignore error */
                baseUrl = undefined
            }

            inputArg.options.baseUrl = baseUrl
            callback(null, {
                ...inputArg,
                markdown: body,
            })
        });
    } else {
        fs.stat(filenameOrUrl, (err1, stats) => {
            if (err1) {
                callback(err1)
            }
            if (stats.isDirectory()) {
                callback(new Error(`Error: file "${filenameOrUrl}" is a directory. Please provide a valid filename as an argument.`))
            }
            inputArg.options.baseUrl = 'file://' + path.dirname(path.resolve(filenameOrUrl));
            fs.readFile(filenameOrUrl, inputArg.options.fileEncoding, (err2, data) => {
                if (err2) {
                    callback(err2)
                } else {
                    callback(null, {
                        ...inputArg,
                        markdown: typeof data  === 'string' ? data : data.toString(),
                    })
                }
            })
        })
    }
}

/**
 * 
 * Inputs: markdown content
 * Outputs: {
 *  list of links and their status
 * }
 */
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

    procesMarkdown(markdown, options, callback)
}

/**
 * 
 * Inputs: markdown content
 * Outputs: {
 *  list of links and their status
 * }
 */
export function procesMarkdown(markdown: string, options: Options, callback: Callback): void {
    // Make sure it is not undefined and that the appropriate headers are always recalculated for a given link.
    options.headers = {}

    if (!options.ignoreDisable) {
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
        new ProgressBar('Checking... [:bar] :perce  nt', {
            complete: '=',
            incomplete: ' ',
            width: 25,
            total: linksCollection.length
        }) : undefined;

    const concurrentCheck = options.concurrentCheck || 2
    async.mapLimit(
        linksCollection /*arr*/,
        concurrentCheck /* limit */,
        getLinkCheckIterator(options, bar) /*iterator*/,
        callback /*callback*/);
}

/** Return a linkCheckIterator function after capturing options and bar parameters */
function getLinkCheckIterator(options: Options, bar: ProgressBar | undefined) {
    return function linkCheckIterator(link: string, callback: async.AsyncResultCallback<LinkCheckResult, any>) {
        {
            if (options.ignorePatterns) {
                const shouldIgnore = options.ignorePatterns.some((ignorePattern) => {
                    return ignorePattern.pattern instanceof RegExp ? ignorePattern.pattern.test(link) : (new RegExp(ignorePattern.pattern)).test(link) ? true : false;
                });

                if (shouldIgnore) {
                    const result = new LinkCheckResult(link, 0, Status.IGNORED);
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

            const linkCheckOptions: LinkCheckOptions = {}
            Object.assign(linkCheckOptions, options)

            if (options.httpHeaders) {
                for (const httpHeader of options.httpHeaders) {
                    for (const inputUrl of httpHeader.urls) {
                        if (link.startsWith(inputUrl)) {
                            Object.assign(linkCheckOptions.headers, httpHeader.headers);
                            // The headers of this httpHeader has been applied, the other URLs of this httpHeader don't need to be evaluated any further.
                            break;
                        }
                    }
                }
            }
            linkCheck(link, linkCheckOptions, (err, result) => {
                if (bar) {
                    bar.tick();
                }

                if (err) {
                    callback(null, new LinkCheckResult(link, 0, Status.ERROR, err)); // custom status for errored links)
                } else {
                    callback(null, result)
                }
            });
        }
    }
}
