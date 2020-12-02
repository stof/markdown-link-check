import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'
import * as async from 'async'
import * as request from 'request'
import * as _ from 'lodash'
import ProgressBar from 'progress'
import markdownLinkExtractor = require('markdown-link-extractor')
import { linkCheck, LinkCheckResult, Options as LinkCheckOptions } from '@boillodmanuel/link-check'
import { Options, Status, Callback } from './types'
import { debug } from './debug'

export * from './types'
export { LinkCheckResult }

export interface ProcessInputResults {
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
    callback: Callback<(ProcessInputResults | undefined)[]>, // eslint-disable-line @typescript-eslint/no-explicit-any
): void {
    const globalFileEncoding = options.fileEncoding

    const inputArgs: InputArg[] = inputsArgs.inputs.map((input) => {
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
        options.concurrentFileCheck || 2 /* limit */,
        processInput /*iterator*/,
        callback /*callback*/)
}

interface InputArg {
    filenameOrUrl: string
    options: Options
}

/**
 *
 * Inputs: a filenameOrUrl
 * Outputs: {
 *  filenameOrUrl
 *  list of links and their status
 * }
 */
function processInput(inputArg: InputArg, callback: Callback<ProcessInputResults>) {
    if (inputArg.options.debug) {
        debug(inputArg.options.debugToStdErr, 0, "[INPUT] Process : '" + inputArg.filenameOrUrl + "'")
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractMarkdownFromInput(inputArg, (err1: any, result1?: ExtractMarkdownResult) => {
        if (err1) {
            callback(err1)
        } else {
            const r1 = result1! // eslint-disable-line @typescript-eslint/no-non-null-assertion
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            procesMarkdown(r1, (err2: any, result2?: (LinkCheckResult | undefined)[]) => {
                if (err2) {
                    callback(err2)
                } else {
                    const r2 = result2! // eslint-disable-line @typescript-eslint/no-non-null-assertion
                    callback(null, {
                        filenameOrUrl: inputArg.filenameOrUrl,
                        options: r1.options,
                        results: r2,
                    })
                }
            })
        }
    })
}

interface InputArg {
    filenameOrUrl: string
    options: Options
}
interface ExtractMarkdownResult {
    filenameOrUrl: string
    inputBaseUrl: string | undefined
    markdown: string
    options: Options
}

function extractMarkdownFromInput(inputArg: InputArg, callback: Callback<ExtractMarkdownResult>) {
    const filenameOrUrl = inputArg.filenameOrUrl
    if (/https?:/.test(filenameOrUrl)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.get(filenameOrUrl, (error: any, response: request.Response, body: any): void => {
            if (error) {
                callback(error)
            } else if (response.statusCode === 404) {
                callback(
                    new Error(
                        `Error: 404 - not found for URL ${filenameOrUrl}. Please provide a valid URL as an argument.`,
                    ),
                )
            }

            let inputBaseUrl
            try {
                // extract baseUrl from supplied URL
                const parsed = url.parse(filenameOrUrl)
                parsed.search = null
                parsed.hash = null
                if (parsed.pathname && parsed.pathname.lastIndexOf('/') !== -1) {
                    parsed.pathname = parsed.pathname.substr(0, parsed.pathname.lastIndexOf('/') + 1)
                }
                inputBaseUrl = url.format(parsed)
            } catch (err) {
                callback(new Error(`Error: cannot get base url of url "${filenameOrUrl}".`))
                return
            }

            callback(null, {
                ...inputArg,
                markdown: body,
                inputBaseUrl,
            })
        })
    } else {
        fs.stat(filenameOrUrl, (err1, stats) => {
            if (err1) {
                callback(err1)
            }
            if (stats.isDirectory()) {
                callback(
                    new Error(
                        `Error: file "${filenameOrUrl}" is a directory. Please provide a valid filename as an argument.`,
                    ),
                )
            }

            const inputBaseUrl = 'file://' + path.dirname(path.resolve(filenameOrUrl))
            fs.readFile(filenameOrUrl, inputArg.options.fileEncoding, (err2, data) => {
                if (err2) {
                    callback(err2)
                } else {
                    callback(null, {
                        ...inputArg,
                        markdown: typeof data === 'string' ? data : data.toString(),
                        inputBaseUrl,
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
export function markdownLinkCheck(
    markdown: string,
    optionsArg: Options | Callback<(LinkCheckResult | undefined)[]>,
    callbackArg?: Callback<(LinkCheckResult | undefined)[]>,
): void {
    let options: Options
    let callback: Callback<(LinkCheckResult | undefined)[]>

    if (arguments.length === 2 && typeof optionsArg === 'function') {
        // optional 'opts' not supplied.
        callback = optionsArg as Callback<(LinkCheckResult | undefined)[]>
        options = {}
    } else if (arguments.length === 3 && callbackArg) {
        callback = callbackArg
        options = optionsArg as Options
    } else {
        throw new Error('Unexpected arguments')
    }

    const extractMarkdownResult: ExtractMarkdownResult = {
        filenameOrUrl: "?",
        inputBaseUrl: undefined,
        markdown,
        options,        
    }
    procesMarkdown(extractMarkdownResult, callback)
}

/**
 *
 * Inputs: markdown content
 * Outputs: {
 *  list of links and their status
 * }
 */
function procesMarkdown(
    extractMarkdownResult: ExtractMarkdownResult,
    callback: Callback<(LinkCheckResult | undefined)[]>,
): void {
    // Make sure it is not undefined and that the appropriate headers are always recalculated for a given link.
    const options = extractMarkdownResult.options
    let markdown = extractMarkdownResult.markdown

    options.headers = {}

    if (!options.ignoreDisable) {
        markdown = [
            /(<!--[ \t]+markdown-link-check-disable[ \t]+-->[\S\s]*?<!--[ \t]+markdown-link-check-enable[ \t]+-->)/gm,
            /(<!--[ \t]+markdown-link-check-disable[ \t]+-->[\S\s]*(?!<!--[ \t]+markdown-link-check-enable[ \t]+-->))/gm,
            /(<!--[ \t]+markdown-link-check-disable-next-line[ \t]+-->\r?\n[^\r\n]*)/gm,
            /([^\r\n]*<!--[ \t]+markdown-link-check-disable-line[ \t]+-->[^\r\n]*)/gm,
        ].reduce((_markdown, disablePattern) => {
            return _markdown.replace(new RegExp(disablePattern), '')
        }, markdown)
    }

    const linksCollection: string[] = _.uniq(markdownLinkExtractor(markdown))
    const bar = options.showProgressBar
        ? new ProgressBar('Checking... [:bar] :perce  nt', {
            complete: '=',
            incomplete: ' ',
            width: 25,
            total: linksCollection.length,
        })
        : undefined

    const concurrentCheck = options.concurrentCheck || 2
    async.mapLimit(
        linksCollection /*arr*/,
        concurrentCheck /* limit */,
        getLinkCheckIterator(extractMarkdownResult, bar) /*iterator*/,
        callback /*callback*/,
    )
}

/** Return a linkCheckIterator function after capturing extractMarkdownResult and bar parameters */
function getLinkCheckIterator(extractMarkdownResult: ExtractMarkdownResult, bar: ProgressBar | undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function linkCheckIterator(link: string, callback: async.AsyncResultCallback<LinkCheckResult, any>) {
        {
            const options = extractMarkdownResult.options

            if (options.ignorePatterns) {
                const shouldIgnore = options.ignorePatterns.some((ignorePattern) => {
                    return ignorePattern.pattern instanceof RegExp
                        ? ignorePattern.pattern.test(link)
                        : new RegExp(ignorePattern.pattern).test(link)
                            ? true
                            : false
                })

                if (shouldIgnore) {
                    const result = new LinkCheckResult(link, 0, Status.IGNORED)
                    callback(null, result)
                    return
                }
            }

            if (options.debug) {
                debug(options.debugToStdErr, 0, "[LINK] Link: '" + link + "'")
            }
            if (options.replacementPatterns) {
                const initialLink = link
                for (const replacementPattern of options.replacementPatterns) {
                    const pattern =
                        replacementPattern.pattern instanceof RegExp
                            ? replacementPattern.pattern
                            : new RegExp(replacementPattern.pattern)
                    link = link.replace(pattern, replacementPattern.replacement)
                }
                if (options.debug && link !== initialLink) {
                    debug(options.debugToStdErr, 0, "[LINK] Replacement(s) made: '" + link + "'")
                }
            }
            
            const linkCheckOptions: LinkCheckOptions = {}
            Object.assign(linkCheckOptions, options)

            if (options.httpHeaders) {
                for (const httpHeader of options.httpHeaders) {
                    for (const inputUrl of httpHeader.urls) {
                        if (link.startsWith(inputUrl)) {
                            Object.assign(linkCheckOptions.headers, httpHeader.headers)
                            // The headers of this httpHeader has been applied, the other URLs of this httpHeader don't need to be evaluated any further.
                            break
                        }
                    }
                }
            }

            // absolute path refer to baseUrl (if any)
            if (options.resolveAbsolutePathWithBaseUrl) {
                if (!options.baseUrl) {
                    callback(new Error(`Error: "resolveAbsolutePathWithBaseUrl" could not be true when "baseUrl" is empty`))
                    return
                } else if (options.baseUrl.endsWith("/")) {
                    callback(new Error(`Error: "baseUrl" could not end with "/" when "resolveAbsolutePathWithBaseUrl" is true`))
                    return
                }
                // Strip "file://" if any
                const filePath = url.parse(options.baseUrl, false, true).path
                if (!filePath) {
                    callback(new Error(`Error: baseUrl "${options.baseUrl}" could not parsed`))
                    return
                }
                if (path.isAbsolute(link)) {
                    link = link.replace(/^\//, '')
                } else {
                    linkCheckOptions.baseUrl = extractMarkdownResult.inputBaseUrl
                }
            } else {
                if (extractMarkdownResult.inputBaseUrl) {
                    linkCheckOptions.baseUrl = extractMarkdownResult.inputBaseUrl
                }
            }

            linkCheck(link, linkCheckOptions, (err, result) => {
                if (bar) {
                    bar.tick()
                }

                if (err) {
                    callback(null, new LinkCheckResult(link, 0, Status.ERROR, err)) // custom status for errored links)
                } else {
                    callback(null, result)
                }
            })
        }
    }
}
