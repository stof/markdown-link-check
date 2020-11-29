#!/usr/bin/env node

import chalk from 'chalk'
import fs from 'fs'
import program from 'commander'
import { Options, processInputs, ProcessInputResults, InputsArgs, Status } from '../'

const statusLabels: { [status: string]: string } = {
    alive: chalk.green('✓'),
    dead: chalk.red('✖'),
    ignored: chalk.gray('/'),
    error: chalk.yellow('⚠'),
}

export interface CmdOptions {
    config?: string
    quiet?: boolean
    verbose?: boolean
    debug?: boolean
    retryOnError?: boolean
    retryOn429?: boolean
    timeout?: string
    fileEncoding?: string
    inputs?: string[]
}

// tslint:disable:no-console
function run(filenameOrUrl: string, cmdObj: CmdOptions): void {
    const inputs = cmdObj.inputs || [filenameOrUrl]
    const options = getOptions(cmdObj)
    overrideOptionswithCmdObj(options, cmdObj)
    const inputsArgs: InputsArgs = {
        inputs: inputs.map((input) => {
            return { filenameOrUrl: input }
        }),
    }
    processInputs(inputsArgs, options, (err: any, results?: (ProcessInputResults | undefined)[]) => {
        printInputsResult(cmdObj, err, results)
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
    return options
}

function overrideOptionswithCmdObj(options: Options, cmdObj: CmdOptions) {
    if (cmdObj.debug) {
        options.debug = cmdObj.debug
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
function printInputsResult(cmdObj: CmdOptions, err: any, results?: (ProcessInputResults | undefined)[]): void {
    if (err) {
        console.error(chalk.red('ERROR: something went wrong!'))
        console.error(err)
        process.exit(1)
    }

    if (!results || results.length === 0) {
        console.error(chalk.red('ERROR: No input processed! (should not happen)'))
        process.exit(1)
    }

    const inputCount = results.length
    let linksCount = 0
    let notAliveLinksCount = 0

    for (const result of results) {
        if (!result) {
            if (!cmdObj.quiet) {
                console.log(chalk.yellow('Warning: no detail! (should not happen)'))
            }
        } else {
            const stats = printInputResult(cmdObj, result)
            linksCount += stats.linksCount
            notAliveLinksCount += stats.notAliveLinksCount
        }
    }

    // print summary
    console.log()
    console.log('SUMMARY:')
    console.log('--------')
    console.log('Total inputs:', inputCount)
    console.log('Total links:', linksCount)
    console.log('Total not alive:', notAliveLinksCount)

    process.exit(notAliveLinksCount === 0 ? 0 : 1)
}

interface InputStats {
    linksCount: number
    notAliveLinksCount: number
}

function printInputResult(cmdObj: CmdOptions, result: ProcessInputResults): InputStats {
    console.log()
    console.log(chalk.cyan('Input: ' + result.filenameOrUrl))

    const linkResults = result.results
    if (!linkResults) {
        if (!cmdObj.verbose) {
            console.log(chalk.yellow('Debug: No hyperlinks found!'))
        }
        return {
            linksCount: 0,
            notAliveLinksCount: 0,
        }
    }

    let notAliveLinksCount = 0
    for (const linkResult of linkResults!) {
        if (!linkResult) {
            if (!cmdObj.quiet) {
                console.log(chalk.yellow('Warning: no link detail! (should not happen)'))
            }
        } else {
            const isAlive = linkResult.status === Status.ALIVE
            // Skip alive messages in quiet mode.
            if (isAlive) {
                if (cmdObj.quiet) {
                    break
                }
            } else {
                notAliveLinksCount++
            }

            const statusLabel = statusLabels[linkResult.status] || '?'
            // prettier-ignore
            console.log(
                `[${statusLabel}] ${linkResult.link}` +
                (!isAlive || cmdObj.verbose ? ` → Status: ${linkResult.statusCode}` : "") +
                (linkResult.err ? chalk.red(` (Error: ${linkResult.err})`) : "") +
                (linkResult.additionalMessages ? chalk.yellow(` (Warning: ${linkResult.additionalMessages})`) : "")
            )
        }
    }

    const linksCount = linkResults.length
    console.log('%s links checked.', linksCount)
    if (notAliveLinksCount) {
        console.log(chalk.red('ERROR: %s not alive links found!'), notAliveLinksCount)
    }

    return {
        linksCount,
        notAliveLinksCount,
    }
}
// tslint:enable:no-console

program
    // .option('-p, --progress', 'show progress bar')
    .option('-c, --config [config]', 'apply a config file (JSON), holding e.g. url specific header configuration')
    .option('-q, --quiet', 'displays errors only')
    .option('-v, --verbose', 'displays detailed error information')
    .option('-d, --debug', 'displays debug information')
    .option('-i, --inputs <inputs...>', 'list of inputs')
    // .option('-a, --alive <code>', 'comma separated list of HTTP codes to be considered as alive', commaSeparatedCodesList)
    .option('--retryOnError', 'retry after an error')
    .option('--retryOn429', "retry after the duration indicated in 'retry-after' header when HTTP code is 429")
    .option('-e, --fileEncoding <string>', '')
    .option('--timeout <string>', '')
    .arguments('[filenameOrUrl]')
    .action(run)
    .parse(process.argv)
