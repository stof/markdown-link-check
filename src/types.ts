import { linkCheck, LinkCheckResult, Options } from 'link-check/src'

export type Callback = (err: any, result: any | null) => void


export interface MarkdownLinkCheckOptions extends Options {
    ignoreDisable?: boolean
    showProgressBar?: boolean
    ignorePatterns?: IgnorePattern[]
    replacementPatterns?: ReplacementPattern[]
}

export interface IgnorePattern {
    pattern: string | RegExp
}
export interface ReplacementPattern {
    pattern: string | RegExp
    replacement: string
}

export enum Status {
    ALIVE = 'alive',
    DEAD = 'dead',
    IGNORE = 'ignore',
}

export class MarkdownLinkCheckResult extends LinkCheckResult{
    public readonly status: Status

    // constructor(opts: Options, link: string, statusCode: number, err?: any, originalError?: any) {
    //     this.link = link
    //     this.statusCode = statusCode || 0
    //     this.status = isAlive(opts, statusCode) ? Status.ALIVE : Status.DEAD
    //     this.err = err || null
    //     this.originalError = originalError || err || null
    // }
}