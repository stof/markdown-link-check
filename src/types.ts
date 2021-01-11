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
    /* Number of file or url processed concurrently. Default is 2. */
    concurrentFileCheck?: number
    /* Number of links processed concurrently for a single file or url. Default is 2. */
    concurrentCheck?: number
    /* Set file enconding. Default is `utf-8`.*/
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
