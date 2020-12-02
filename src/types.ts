import { Options as LinkCheckOptions } from '@boillodmanuel/link-check'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Callback<T> = (err: any, result?: T) => void

export enum Status {
    ALIVE = 'alive',
    DEAD = 'dead',
    IGNORED = 'ignored',
    ERROR = 'error',
}

export interface Options extends LinkCheckOptions {
    ignoreDisable?: boolean
    showProgressBar?: boolean
    resolveAbsolutePathWithBaseUrl?: boolean
    ignorePatterns?: IgnorePattern[]
    replacementPatterns?: ReplacementPattern[]
    httpHeaders?: HttpHeader[]
    concurrentFileCheck?: number
    concurrentCheck?: number
    fileEncoding?: string
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
    headers: { [key: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any
}
