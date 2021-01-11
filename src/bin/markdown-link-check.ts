import chalk from 'chalk'
import fs from 'fs'
import program from 'commander'
import { Options, processInputs, ProcessInputsResults, ProcessInputResults, InputsArgs, Status } from '../'

const statusLabels: { [status: string]: string } = {
    alive: chalk.green('✓'),
    dead: chalk.red('✖'),
    ignored: chalk.gray('/'),
    error: chalk.yellow('⚠'),
}

export interface CmdOptions {
    config?: string
    timeout?: string
    fileEncoding?: string
    quiet: boolean
    verbose: boolean
    alive: (number | RegExp)[]
    debug: boolean
    printSummary: boolean
    printCacheStats: boolean
    printLongChecks: boolean
    longChecksMaxDuration: number
    retryOnError: boolean
    retryOn429: boolean
}

// tslint:disable:no-console
function run(filenameOrUrls: string[], cmdObj: CmdOptions): void {
    const options = getOptions(cmdObj)
    overrideOptionswithCmdObj(options, cmdObj)

    if (filenameOrUrls) {
        const inputsArgs: InputsArgs = {
            inputs: filenameOrUrls.map((input) => {
                return { filenameOrUrl: input }
            }),
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        processInputs(inputsArgs, options, (err: any, processInputsResults?: ProcessInputsResults) => {
            printInputsResult(cmdObj, err, processInputsResults)
        })
    } else {
        readFromStdin((stdin) => {
            const inputsArgs: InputsArgs = {
                inputs: [
                    {
                        filenameOrUrl: 'stdin',
                        markdown: stdin,
                    },
                ],
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            processInputs(inputsArgs, options, (err: any, processInputsResults?: ProcessInputsResults) => {
                printInputsResult(cmdObj, err, processInputsResults)
            })
        })
    }
}

function readFromStdin(callback: (stdin: string) => void) {
    const stream = process.stdin
    let stdin = ''
    stream
        .on('data', function (chunk) {
            stdin += chunk.toString()
        })
        .on('error', function (error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((error as any).code === 'ENOENT') {
                console.error(chalk.red('\nERROR: File not found! Please provide a valid filename as an argument.'))
            } else {
                console.error(chalk.red(error))
            }
            return process.exit(1)
        })
        .on('end', function () {
            callback(stdin)
        })
}

function getOptions(cmdObj: CmdOptions): Options {
    let options: Options
    if (cmdObj.config) {
        let configContent
        try {
            configContent = fs.readFileSync(cmdObj.config)
        } catch (err) {
            console.error(chalk.red('ERROR: Error reading config file'), '. Error:', err)
            process.exit(1)
        }
        options = JSON.parse(configContent.toString())
        if (typeof options !== 'object') {
            console.error(chalk.red(`ERROR: Config is not a valid JSON Object: ${options}`))
            process.exit(1)
        }
    } else {
        options = {}
    }
    // set default
    if (cmdObj.quiet === undefined) {
        cmdObj.quiet = false
    }
    if (cmdObj.verbose === undefined) {
        cmdObj.verbose = false
    }
    if (cmdObj.debug === undefined) {
        cmdObj.debug = false
    }
    if (cmdObj.printSummary === undefined) {
        cmdObj.printSummary = false
    }
    if (cmdObj.printCacheStats === undefined) {
        cmdObj.printCacheStats = false
    }
    if (cmdObj.printLongChecks === undefined) {
        cmdObj.printLongChecks = false
    }
    if (cmdObj.longChecksMaxDuration === undefined) {
        cmdObj.longChecksMaxDuration = 5000 // 5s
    }
    if (cmdObj.retryOnError === undefined) {
        cmdObj.retryOnError = false
    }
    if (cmdObj.retryOn429 === undefined) {
        cmdObj.retryOn429 = false
    }
    return options
}

function overrideOptionswithCmdObj(options: Options, cmdObj: CmdOptions) {
    if (cmdObj.debug) {
        options.debug = cmdObj.debug
    }
    if (cmdObj.retryOn429) {
        options.aliveStatusCodes = cmdObj.alive
    }
    if (cmdObj.retryOn429) {
        options.retryOn429 = cmdObj.retryOn429
    }
    if (cmdObj.retryOnError) {
        options.retryOnError = cmdObj.retryOnError
    }
    if (cmdObj.timeout) {
        options.timeout = cmdObj.timeout
    }
    if (cmdObj.fileEncoding) {
        options.fileEncoding = cmdObj.fileEncoding
    }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function printInputsResult(cmdObj: CmdOptions, err: any, processInputsResults?: ProcessInputsResults): void {
    if (err) {
        console.error(chalk.red('ERROR: something went wrong!'))
        console.error(err)
        process.exit(1)
    }

    if (!processInputsResults) {
        console.error(chalk.red('ERROR: No processInputsResults! (should not happen)'))
        process.exit(1)
    }
    const results = processInputsResults.results
    if (!results || results.length === 0) {
        console.error(chalk.red('ERROR: No input processed! (should not happen)'))
        process.exit(1)
    }

    const inputCount = results.length

    for (const result of results) {
        if (!result) {
            if (!cmdObj.quiet) {
                console.log(chalk.yellow('Warning: no detail! (should not happen)'))
            }
        } else {
            printInputResult(cmdObj, result)
        }
    }

    // print summary
    if (cmdObj.printSummary) {
        console.log()
        console.log(chalk.cyan('SUMMARY:'))
        console.log(chalk.cyan('--------'))
        console.log('Total inputs:', inputCount)
        console.log('Total links:', processInputsResults.stats.linksCount)
        console.log('- alive   :', processInputsResults.stats.aliveLinksCount)
        console.log('- ignored :', processInputsResults.stats.ignoredLinksCount)
        console.log('- error   :', processInputsResults.stats.errorLinksCount)
        console.log('- dead    :', processInputsResults.stats.deadLinksCount)
    }
    if (cmdObj.printCacheStats) {
        console.log()
        console.log(chalk.cyan('CACHE STATISTICS:'))
        console.log(chalk.cyan('--------'))
        console.log('Cache:', processInputsResults.stats.linksCount)
        console.log('- hits   :', processInputsResults.cacheStats.cacheHits)
        console.log('- miss :', processInputsResults.cacheStats.cacheMiss)
    }
    if (cmdObj.printLongChecks) {
        printLongChecks(cmdObj, results)
    }
    const isFailed = processInputsResults.stats.errorLinksCount + processInputsResults.stats.deadLinksCount === 0
    process.exit(isFailed ? 0 : 1)
}

function printInputResult(cmdObj: CmdOptions, result: ProcessInputResults): void {
    console.log()
    console.log(chalk.cyan('Input: ' + result.filenameOrUrl))

    const linkResults = result.results
    let deadLinksCount = 0
    let errorLinksCount = 0

    if (!linkResults) {
        if (!cmdObj.verbose) {
            console.log(chalk.yellow('Warning: No hyperlinks found!'))
        }
        return
    }

    for (const linkResult of linkResults) {
        if (!linkResult) {
            if (!cmdObj.quiet) {
                console.log(chalk.yellow('Warning: no link detail! (should not happen)'))
            }
            break
        }
        if (linkResult.status === Status.ALIVE) {
            // ignore
        } else if (linkResult.status === Status.IGNORED) {
            // ignore
        } else if (linkResult.status === Status.ERROR) {
            errorLinksCount++
        } else if (linkResult.status === Status.DEAD) {
            deadLinksCount++
        } else {
            console.log(chalk.yellow(`Warning: unknowns link status "${linkResult.status}"`))
        }

        const statusLabel = statusLabels[linkResult.status] || '?'
        // prettier-ignore

        const isOk = (linkResult.status === Status.ALIVE || linkResult.status === Status.IGNORED)
        if (cmdObj.quiet && isOk) {
            // Skip alive messages in quiet mode.
            break
        }
        console.log(
            `[${statusLabel}] ${linkResult.link}` +
                (!isOk || cmdObj.verbose ? ` → Status: ${linkResult.statusCode}` : '') +
                (cmdObj.verbose ? ` in ${linkResult.stats.durationInMs} ms` : '') +
                (cmdObj.verbose && linkResult.stats.retryCount ? ` after ${linkResult.stats.retryCount} retry)` : '') +
                (linkResult.err ? chalk.red(` (Error: ${linkResult.err})`) : '') +
                (linkResult.additionalMessages ? chalk.yellow(` (Warning: ${linkResult.additionalMessages})`) : ''),
        )
    }

    const linksCount = linkResults.length
    console.log('%s links checked.', linksCount)
    if (deadLinksCount) {
        console.log(chalk.red('ERROR: %s dead links found!'), deadLinksCount)
    }
    if (errorLinksCount) {
        console.log(chalk.red('ERROR: %s error links found!'), errorLinksCount)
    }
}

function printLongChecks(cmdObj: CmdOptions, results: (ProcessInputResults | undefined)[]): void {
    console.log()
    console.log(chalk.cyan('LONG CHECK:'))
    console.log(chalk.cyan('--------'))

    for (const result of results) {
        if (!result) {
            if (!cmdObj.quiet) {
                console.log(chalk.yellow('Warning: no detail! (should not happen)'))
            }
        } else {
            printLongChecksInput(cmdObj, result)
        }
    }
}

function printLongChecksInput(cmdObj: CmdOptions, result: ProcessInputResults): void {
    const linkResults = result.results
    if (!linkResults) {
        if (!cmdObj.verbose) {
            console.log(chalk.yellow('Warning: No hyperlinks found!'))
        }
        return
    }

    for (const linkResult of linkResults) {
        if (!linkResult) {
            if (!cmdObj.quiet) {
                console.log(chalk.yellow('Warning: no link detail! (should not happen)'))
            }
            break
        }
        if (linkResult.stats.durationInMs && linkResult.stats.durationInMs > cmdObj.longChecksMaxDuration) {
            console.log(
                `- ${linkResult.link}: ` +
                    // duration
                    (linkResult.stats.durationInMs > cmdObj.longChecksMaxDuration * 10
                        ? chalk.red(`${linkResult.stats.durationInMs} ms (> 10x)`)
                        : chalk.yellow(`${linkResult.stats.durationInMs} ms`)) +
                    // retry count if any
                    (linkResult.stats.retryCount && linkResult.stats.retryCount > 0
                        ? ` (retry: ${linkResult.stats.retryCount}`
                        : ''),
            )
        }
    }
}

function commaSeparatedCodesList(value: string) {
    return value.split(',').map(function (item) {
        return parseInt(item, 10)
    })
}

program
    // Options specific to command line:
    .option('-c, --config [config]', 'apply a config file (JSON), holding e.g. url specific header configuration')
    .option('-q, --quiet', 'displays errors only')
    .option('-v, --verbose', 'displays detailed error information')
    .option('-d, --debug', 'displays debug information')
    .option(
        '--print-summary',
        'print total number of inputs and links process with details about link status (alive, ignored, dead, error)',
    )
    .option('--print-cache-stats', 'print cache usage (hits and misses).')
    .option(
        '--print-long-checks',
        'print links that took more than given delay to verify. Default delay is 5000, configure it with --long-checks-max-duration option',
    )
    .option('--long-checks-max-duration <number>', 'configure delay for long check. Default is 5000.')
    // Options that override config file:
    .option(
        '-a, --alive <code>',
        'comma separated list of HTTP codes to be considered as alive',
        commaSeparatedCodesList,
    )
    .option('--retry-on-error', 'retry after an error')
    .option('--retry-on-429', "retry after the duration indicated in 'retry-after' header when HTTP code is 429")
    .option('--timeout <string>', 'timeout in zeit/ms format. (e.g. "2000ms", 20s, 1m). Default is 10s.')
    .option('-e, --fileEncoding <string>', '')
    .arguments('[filenameOrUrls...]')
    .description('[filenameOrUrls...] One or several markdown files or URLs to check. If absent, check stdin.')
    .action(run)
    .parse(process.argv)
