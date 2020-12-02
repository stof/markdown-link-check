import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'
import express from 'express'
import expect from 'expect.js'

import { markdownLinkCheck, processInputs, ProcessInputResults, InputsArgs, Options, ProcessInputsResults } from '../src'

/* eslint-disable @typescript-eslint/no-non-null-assertion*/
describe('markdown-link-check', function () {
    const MAX_RETRY_COUNT = 5
    // add a longer timeout on tests so we can really test real cases.
    // Mocha default is 2s, make it 5s here.
    this.timeout(5000)

    let baseUrl: string

    before((done) => {
        const app = express()

        let laterRetryCount = 0

        app.head('/nohead', (req, res) => {
            res.sendStatus(405) // method not allowed
        })
        app.get('/nohead', (req, res) => {
            res.sendStatus(200)
        })

        app.get('/partial', (req, res) => {
            res.sendStatus(206)
        })

        app.get('/later', (req, res) => {
            if (laterRetryCount < MAX_RETRY_COUNT) {
                laterRetryCount++
                if (laterRetryCount !== 2) {
                    res.append('retry-after', '2s')
                }
                res.sendStatus(429)
            } else {
                laterRetryCount = 0
                res.sendStatus(200)
            }
        })

        app.get('/foo/redirect', (req, res) => {
            res.redirect('/foo/bar')
        })
        app.get('/foo/bar', (req, res) => {
            res.json({ foo: 'bar' })
        })

        app.get('/basic-auth', (req, res) => {
            // tslint:disable-next-line:no-string-literal
            if (req.headers['authorization'] === 'Basic Zm9vOmJhcg==') {
                res.sendStatus(200)
            } else {
                res.sendStatus(401)
            }
        })

        app.get('/loop', (req, res) => {
            res.redirect('/loop')
        })

        app.get('/hello.jpg', (req, res) => {
            res.sendFile('hello.jpg', {
                root: path.join(__dirname, 'http/www'),
                dotfiles: 'deny',
            })
        })

        app.get('/foo\\(a=b.42\\).aspx', (req, res) => {
            res.json({ a: 'b' })
        })

        const server = http.createServer(app)
        server.listen(0 /* random open port */, 'localhost', function serverListen() {
            const address =
                typeof server.address() === 'string'
                    ? server.address()
                    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (server.address() as any).address + ':' + (server.address() as any).port
            baseUrl = 'http://' + address
            done()
        })
    })

    it('should check the links in sample.md and resolve relative path to HTTP', (done) => {
        const input = fs
            .readFileSync(path.join(__dirname, 'http/sample.md'))
            .toString()
            .replace(/%%BASE_URL%%/g, baseUrl)

        markdownLinkCheck(
            input,
            {
                baseUrl,
                ignorePatterns: [{ pattern: /not-working-and-ignored/ }],
                replacementPatterns: [{ pattern: /boo/, replacement: 'foo' }],
                httpHeaders: [
                    {
                        urls: [baseUrl + '/basic-auth'],
                        headers: { Authorization: 'Basic Zm9vOmJhcg==', Foo: 'Bar' },
                    },
                ],
                aliveStatusCodes: [200, 206],
                retryOn429: true,
                retryCount: MAX_RETRY_COUNT,
                fallbackRetryDelay: '500ms',
            },
            (err, results) => {
                expect(err).to.be(null)
                expect(results).to.be.an('array')

                const expected = [
                    // redirect-loop
                    { statusCode: 0, status: 'dead' },

                    // valid
                    { statusCode: 200, status: 'alive' },

                    // invalid
                    { statusCode: 404, status: 'dead' },

                    // dns-resolution-fail
                    { statusCode: 0, status: 'dead' },

                    // nohead-get-ok
                    { statusCode: 200, status: 'alive' },

                    // redirect
                    { statusCode: 200, status: 'alive' },

                    // basic-auth
                    { statusCode: 200, status: 'alive' },

                    // ignored
                    { statusCode: 0, status: 'ignored' },

                    // replaced
                    { statusCode: 200, status: 'alive' },

                    // request rate limit return 429, retry later and get 200
                    { statusCode: 200, status: 'alive' },

                    // partial
                    { statusCode: 206, status: 'alive' },

                    // hello image
                    { statusCode: 200, status: 'alive' },

                    // hello image
                    { statusCode: 200, status: 'alive' },

                    // valid e-mail
                    { statusCode: 200, status: 'alive' },

                    // invalid e-mail
                    { statusCode: 400, status: 'dead' },

                    // invalid protocol
                    { statusCode: 0, status: 'error' },

                    // invalid protocol
                    { statusCode: 0, status: 'error' },
                ]
                expect(results!.length).to.be(expected.length)

                for (let i = 0; i < results!.length; i++) {
                    expect(results![i]!.statusCode).to.be(expected[i].statusCode)
                    expect(results![i]!.status).to.be(expected[i].status)
                }

                done()
            },
        )
    })

    it('should check the links in file.md and resolve relative path to FILE', (done) => {
        const baseDir = path.join(__dirname, 'file/single')
        const input = fs
            .readFileSync(path.join(baseDir, 'file.md'))
            .toString()
            .replace(/%%BASE_DIR%%/g, baseDir)

        markdownLinkCheck(input, { baseUrl: `file://${baseDir}` }, (err, results) => {
            expect(err).to.be(null)
            expect(results).to.be.an('array')

            const expected = [
                { statusCode: 200, status: 'alive' },
                { statusCode: 200, status: 'alive' },
                { statusCode: 404, status: 'dead' },
            ]

            expect(results!.length).to.be(expected.length)

            for (let i = 0; i < results!.length; i++) {
                // console.log(`results[${i}]`)
                expect(results![i]!.statusCode).to.be(expected[i].statusCode)
                expect(results![i]!.status).to.be(expected[i].status)
            }

            done()
        })
    })

    it('should handle links with parens', (done) => {
        markdownLinkCheck('[test](' + baseUrl + '/foo(a=b.42).aspx)', (err, results) => {
            expect(err).to.be(null)
            expect(results).to.be.an('array')
            expect(results).to.have.length(1)
            expect(results![0]!.statusCode).to.be(200)
            expect(results![0]!.status).to.be('alive')
            done()
        })
    })

    it('should handle multiple inputs and resolve relative path to FILE', (done) => {
        const baseDir = path.join(__dirname, 'file/multiple')

        const inputsArgs: InputsArgs = {
            inputs: [
                { filenameOrUrl: path.join(baseDir, 'file1.md') },
                { filenameOrUrl: path.join(baseDir, 'file2.md') },
            ],
        }
        const options: Options = {}

        const expectations: Expectations = {
            stats: {
                linksCount: 8,
                aliveLinksCount: 6,
                ignoredLinksCount: 0,
                deadLinksCount: 2,
                errorLinksCount: 0,
            },
            cacheStats: {
                cacheHits: 2,
                cacheMiss: 6,
            },
            results: [
                {
                    file: path.join(baseDir, 'file1.md'),
                    links: [
                        { statusCode: 200, status: 'alive', link: 'hello-multiple.jpg' },
                        { statusCode: 200, status: 'alive', link: './hello-multiple.jpg' },
                        { statusCode: 200, status: 'alive', link: 'file1.md' },
                        { statusCode: 200, status: 'alive', link: './file1.md' },
                    ],
                },
                {
                    file: path.join(baseDir, 'file2.md'),
                    links: [
                        { statusCode: 200, status: 'alive', link: 'file1.md' },
                        { statusCode: 200, status: 'alive', link: './file1.md' },
                        { statusCode: 404, status: 'dead', errCode: 'ENOENT', link: 'null.md' },
                        { statusCode: 404, status: 'dead', errCode: 'ENOENT', link: './null.md' },
                    ],
                },
            ]
        }

        processInputs(inputsArgs, options, (err, results) => {
            expectResultsToBeExpectations(err, results, expectations)

            done()
        })
    })

    it('should handle multiple inputs with nested folder and resolve relative path to FILE', (done) => {
        const baseDir = path.join(__dirname, 'file/nested')

        const inputsArgs: InputsArgs = {
            inputs: [
                { filenameOrUrl: path.join(baseDir, 'file1.md') },
                { filenameOrUrl: path.join(baseDir, 'file2.md') },
                { filenameOrUrl: path.join(baseDir, 'subdir/subfile1.md') },
                { filenameOrUrl: path.join(baseDir, 'subdir/subfile2.md') },
            ],
        }
        const options: Options = {
            baseUrl: `file://${baseDir}`,
            resolveAbsolutePathWithBaseUrl: true,
            replacementPatterns: [
                {
                    // link to markdown file doesn't ends with .md (don't process assets folder)
                    // - file => - /file.md
                    // - /assets/file => - assets/file
                    pattern: '^(?!/assets)(.*?)(#.*)?$',
                    replacement: '$1.md',
                },
            ],
            // debug: true, concurrentCheck: 1, concurrentFileCheck: 1
        }

        // IMPORTANT NOTES:
        // links starting with a "/" have the "/" striped because absolute path is resolved with baseUrl
        const expectations: Expectations = {
            stats: {
                linksCount: 14,
                aliveLinksCount: 14,
                ignoredLinksCount: 0,
                deadLinksCount: 0,
                errorLinksCount: 0,
            },
            cacheStats: {
                cacheHits: 6,
                cacheMiss: 8,
            },
            results: [
                {
                    file: path.join(baseDir, 'file1.md'),
                    links: [
                        { statusCode: 200, status: 'alive', link: 'file1.md' },
                        { statusCode: 200, status: 'alive', link: './file1.md' },
                        { statusCode: 200, status: 'alive', link: 'file1.md' },
                        { statusCode: 200, status: 'alive', link: 'file1.md' },
                        { statusCode: 200, status: 'alive', link: 'assets/hello-nested.jpg' },
                    ],
                },
                {
                    file: path.join(baseDir, 'file2.md'),
                    links: [
                        { statusCode: 200, status: 'alive', link: 'subdir/subfile2.md' },
                        { statusCode: 200, status: 'alive', link: './subdir/subfile2.md' },
                        { statusCode: 200, status: 'alive', link: 'subdir/subfile2.md' },
                    ],
                },
                {
                    file: path.join(baseDir, 'subdir/subfile1.md'),
                    links: [
                        { statusCode: 200, status: 'alive', link: 'subfile2.md' },
                        { statusCode: 200, status: 'alive', link: './subfile2.md' },
                        { statusCode: 200, status: 'alive', link: 'subdir/subfile2.md' },
                        { statusCode: 200, status: 'alive', link: '../file1.md' },
                        { statusCode: 200, status: 'alive', link: 'file1.md' },
                        { statusCode: 200, status: 'alive', link: 'assets/hello-nested.jpg' },
                    ],
                },
                {
                    file: path.join(baseDir, 'subdir/subfile2.md'),
                    links: [],
                },
            ]
        }

        processInputs(inputsArgs, options, (err, results) => {
            expectResultsToBeExpectations(err, results, expectations)

            done()
        })
    })

    it('should handle thousands of links (this test takes up to a minute)', function (done) {
        this.timeout(60000)

        let md = ''
        const nlinks = 1000
        for (let i = 0; i < nlinks; i++) {
            md += '[test](' + baseUrl + '/foo/bar?i=' + i + ')\n'
        }
        markdownLinkCheck(md, (err, results) => {
            expect(err).to.be(null)
            expect(results).to.be.an('array')
            expect(results).to.have.length(nlinks)

            for (const result of results!) {
                expect(result!.statusCode).to.be(200)
                expect(result!.status).to.be('alive')
            }

            done()
        })
    })

})

interface Expectations {
    results: Expectation[]
    stats: {
        linksCount: number
        aliveLinksCount: number
        ignoredLinksCount: number
        deadLinksCount: number
        errorLinksCount: number
    },
    cacheStats: {
        cacheHits: number,
        cacheMiss: number,
    }
}
interface Expectation {
    file: string
    links: {
        link: string
        statusCode: number
        status: string
        errCode?: string
    }[]
}

function expectResultsToBeExpectations(
    err: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    processInputsResults: ProcessInputsResults | undefined,
    expectations: Expectations,
): void {
    expect(err).to.be(null)

    // Stats
    expect(processInputsResults!.stats.aliveLinksCount).to.be(expectations.stats.aliveLinksCount)
    expect(processInputsResults!.stats.ignoredLinksCount).to.be(expectations.stats.ignoredLinksCount)
    expect(processInputsResults!.stats.deadLinksCount).to.be(expectations.stats.deadLinksCount)
    expect(processInputsResults!.stats.errorLinksCount).to.be(expectations.stats.errorLinksCount)

    // Cache
    expect(processInputsResults!.cacheStats.cacheHits).to.be(expectations.cacheStats.cacheHits)
    expect(processInputsResults!.cacheStats.cacheMiss).to.be(expectations.cacheStats.cacheMiss)

    // Results
    const results = processInputsResults!.results!
    expect(results).to.be.an('array')

    expect(results).to.have.length(expectations.results.length)

    for (let i = 0; i < expectations.results.length; i++) {
        // console.log(`expectations[${i}]`)
        const result = results![i]! as ProcessInputResults
        const fileExpectation = expectations.results[i]
        expect(result.filenameOrUrl).to.be(fileExpectation.file)
        expect(result.results).to.not.be(null)

        // compare links
        const linksExpectations = fileExpectation.links
        const linkResults = result.results!
        expect(linkResults).to.be.an('array')
        expect(linkResults.length).to.be(linksExpectations.length)

        for (let j = 0; j < linkResults.length; j++) {
            // console.log(`linkResults[${j}]`, JSON.stringify(linkResults[j]))
            expect(linkResults[j]!.link).to.be(linksExpectations[j].link)
            expect(linkResults[j]!.statusCode).to.be(linksExpectations[j].statusCode)
            if (linksExpectations[j].errCode) {
                expect(linkResults[j]!.err).to.not.be(null)
                expect(linkResults[j]!.err!.code).to.be(linksExpectations[j].errCode)
            } else {
                expect(linkResults[j]!.err).to.be(null)
            }
            expect(linkResults[j]!.statusCode).to.be(linksExpectations[j].statusCode)
            expect(linkResults[j]!.status).to.be(linksExpectations[j].status)
        }
    }
}
