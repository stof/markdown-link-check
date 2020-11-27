import { Options as LinkCheckOptions, LinkCheckResult } from 'link-check'

export type Callback = (err: any, results?: (LinkCheckResult | undefined)[]) => void

export enum Status {
    ALIVE = 'alive',
    DEAD = 'dead',
    IGNORED = 'ignored',
    ERROR = 'error',
}

export interface Options extends LinkCheckOptions {
    ignoreDisable?: boolean
    showProgressBar?: boolean
    ignorePatterns?: IgnorePattern[]
    replacementPatterns?: ReplacementPattern[]
    httpHeaders?: HttpHeader[]
}
export interface IgnorePattern {
    pattern: string | RegExp
}
export interface ReplacementPattern {
    pattern: string | RegExp
    replacement: string
}
export interface HttpHeader {
    urls: string[]
    headers: { [key: string]: any }
}
