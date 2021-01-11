![CI status](https://github.com/boillodmanuel/markdown-link-check/workflows/CI/badge.svg)


ℹ️ Fork of [tcort](https://github.com/tcort/markdown-link-check) repository (version 3.8.3), with several improvements:
- completely rewritten in typescript
- see [CHANGELOG.md](https://github.com/boillodmanuel/markdown-link-check/blob/master/CHANGELOG.md) since v3.8.3 to get full list of improvements (multiple inputs support, cache, concurrency, statistics, debug traces,...)

# markdown-link-check

Extracts links from markdown texts and checks whether each link is
alive (`200 OK`) or dead. 

`mailto:` links are validated with [isemail](https://www.npmjs.com/package/isemail).

# Installation

To add the module to your project, run:

```shell
npm install --save-dev @boillodmanuel/markdown-link-check
```

To install the command line tool globally, run:

```shell
npm install -g @boillodmanuel/markdown-link-check
```

# Usage

## Using from Command line tool (CLI)

The command line tool checks markdown links from 1 or several files or URLs or from standard input.

Note: You can either use this library from a javascript/typescript project (as a node dependency) or from command line.
To run the command line, type:
- `markdown-link-check README.md` if you installed it globally 
- `npx markdown-link-check README.md` if you installed it as a project dependency.

### Documentation

**Usage:** `markdown-link-check [options] [filenameOrUrls...]`

**Argument:**
- `[filenameOrUrls...]`: one or several files or URLs. If absent, process stdin

**Options:**

Options specific to command line:

- `-c, --config [config]`: apply a config file (JSON), holding e.g. url specific header configuration
- `-q, --quiet`: displays errors only
- `-v, --verbose`: displays detailed error information
- `--print-summary`: print total number of inputs and links process with details about link status (alive, ignored, dead, error)
- `--print-cache-stats`                  prints cache usage (hits and misses).
- `--print-long-checks`                  prints links that took more than given delay to verify. Default delay is `5000`, configure it with `--long-checks-max-duration` option.
- `--long-checks-max-duration` <number>  configure delay for long check. Default is `5000`.
- `-h, --help`                           display help for command

Options that override [configuration file](#Configuration):
- `-a, --alive <codes>`           comma separated list of HTTP code to be considered as alive
- `--retry-on-error`          retry after the an error
- `--retry-on-429`            retry after the duration indicated in 'retry-after' header when HTTP code is 429
- `--timeout <duration>`      timeout in zeit/ms format. (e.g. `2000ms`, `20s`, `1m`). Default is `10s`.                   
- `-e, --fileEncoding <encoding>` set file enconding. Default is `utf-8`.
- `-d, --debug`                   displays debug traces (very verbose)

### Examples

**Simple examples:**

```bash
# Check links from a markdown file hosted on the web
markdown-link-check https://github.com/tcort/markdown-link-check/blob/master/README.md

# Check links from a local markdown file
markdown-link-check ./README.md

# Check links from multiples markdown file
markdown-link-check ./README.md ./CHANGELOG.md

# Check links from stdin
curl -s https://github.com/tcort/markdown-link-check/blob/master/README.md | markdown-link-check
```

**Advanced examples:**

Check links for each files

```bash
# Check links from a local markdown folder (recursive)
find . -name \*.md -exec markdown-link-check {} \;
```

Check links for all files (run a single process which can leverage cache)
```bash
# Add files in a bash array (using -print0 to support file names with space or special characters)
FILES=()
while IFS=  read -r -d $'\0' FILE; do
    FILES+=("$FILE")
done < <(find . -name '*.md' ! -path './node_modules/*' -print0)
markdown-link-check --print-summary "${FILES[@]}"
```

















## Using from a node project

This part is not documented. The best way to kwow how to use this library from code is to look at `run` function in [/src/bin/markdown-link-check.ts](./src/bin/markdown-link-check.ts)` which is the entry point of the command line utility.

# Configuration

You can configure the processing with using a configuration file described below.

## Configuration file format

File `config.json` attributes per category:

Input content:
* `fileEncoding`: set file enconding. Default is `utf-8`.

Link management:
* `ignorePatterns`: An array of objects holding regular expressions which a link is checked against and skipped for checking in case of a match.
* `replacementPatterns`: An array of objects holding regular expressions which are replaced in a link with their corresponding replacement string. This behavior allows (for example) to adapt to certain platform conventions hosting the Markdown.
* `httpHeaders`: The headers are only applied to links where the link **starts with** one of the supplied URLs in the `urls` section.
* `resolveAbsolutePathWithBaseUrl`: if `true` links with absolute path (e.g. `/section/page1.md`) are resolved from `baseUrl` (see below) where as links with with relative path (e.g. `./page2.md`) are resolved from current url/path. This option reflects some wiki behavior. Default is `false`.
* `baseUrl`: base url/path used to resolved links with absolute path if `resolveAbsolutePathWithBaseUrl` is true. The value should starts with `file://`, `http://` or `https://`. 


Error management:
* `timeout` timeout in [zeit/ms](https://www.npmjs.com/package/ms) format. (e.g. `"2000ms"`, `20s`, `1m`). Default `10s`.
* `retryOnError` if this is `true` then retry after an error.
* `retryOn429` if this is `true` then retry request when response is an HTTP code 429 after the duration indicated by the `retry-after` response header or by the `fallbackRetryDelay` option.
* `retryCount` the number of retries to be made on a 429 response. Default `2`.
* `fallbackRetryDelay` the delay in [zeit/ms](https://www.npmjs.com/package/ms) format. (e.g. `"2000ms"`, `20s`, `1m`) for retries on a 429 response when no `retry-after` header is returned or when it has an invalid value. Default is `5s`.
* `aliveStatusCodes` a list of HTTP codes to consider as alive.

Concurrency:
* `concurrentFileCheck`: Number of file or url processed concurrently. Default is 2.
* `concurrentCheck`: Number of links processed concurrently for a single file or url. Default is 2.

Debug:
* `debug` displays debug traces
* `debugToStdErr` redirect debug trace to sterr instead of stdout

**Example:**

```json
{
  "ignorePatterns": [
    {
      "pattern": "^http://example.net"
    }
  ],
  "replacementPatterns": [
    {
      "pattern": "^.attachments",
      "replacement": "file://some/conventional/folder/.attachments"
    }
  ],
  "httpHeaders": [
    {
      "urls": ["https://example.com"],
      "headers": {
        "Authorization": "Basic Zm9vOmJhcg==",
        "Foo": "Bar"
      }
    }
  ],
  "timeout": "20s",
  "retryOn429": true,
  "retryCount": 5,
  "fallbackRetryDelay": "30s",
  "aliveStatusCodes": [200, 206],
  "concurrentFileCheck": 5,
  "concurrentCheck": 2,
  "fileEncoding": "utf-8",
  "resolveAbsolutePathWithBaseUrl": true,
  "baseUrl": "/var/wiki",
  "debug": false,
  "debugToStdErr": false,
}
```


## Ignore some links from markdown

You can write html comments to disable markdown-link-check for parts of the text.

`<!-- markdown-link-check-disable -->` disables markdown link check.
`<!-- markdown-link-check-enable -->` reenables markdown link check.
`<!-- markdown-link-check-disable-next-line -->` disables markdown link check for the next line.
`<!-- markdown-link-check-disable-line -->` disables markdown link check for this line.




# Documentation from original repository

**Note:** The documentation in this section comes from original repository and **is not maintained in this fork** but kept for information. this library

## Run using Docker


Docker images are built with each release. Use the `stable` tag for the current stable release.

Add current directory with your `README.md` file as read only volume to `docker run`:

```shell
docker run -v ${PWD}:/tmp:ro --rm -i ghcr.io/tcort/markdown-link-check:stable /tmp/README.md
```

Alternatively, if you wish to target a specific release, images are tagged with semantic versions (i.e. `3`, `3.8`, `3.8.3`)

## Run in a GitHub action

**Note:** Github action is not maintained in this fork.

Please head on to [github-action-markdown-link-check](https://github.com/gaurav-nelson/github-action-markdown-link-check).

## Run in other tools

- [Mega-Linter](https://nvuillam.github.io/mega-linter/): Linters aggregator [including markdown-link-check](https://nvuillam.github.io/mega-linter/descriptors/markdown_markdown_link_check/)

## API

### markdownLinkCheck(markdown, [opts,] callback)

Given a string containing `markdown` formatted text and a `callback`,
extract all of the links and check if they're alive or dead. Call the
`callback` with `(err, results)`

Parameters:

* `markdown` string containing markdown formatted text.
* `opts` optional options object containing any of the following optional fields:
  * `baseUrl` the base URL for relative links.
  * `showProgressBar` enable an ASCII progress bar.
  * `timeout` timeout in [zeit/ms](https://www.npmjs.com/package/ms) format. (e.g. `"2000ms"`, `20s`, `1m`). Default `10s`.
  * `httpHeaders` to apply URL specific headers, see example below.
  * `ignorePatterns` an array of objects holding regular expressions which a link is checked against and skipped for checking in case of a match. Example: `[{ pattern: /foo/ }]`
  * `replacementPatterns` an array of objects holding regular expressions which are replaced in a link with their corresponding replacement string. This behavior allows (for example) to adapt to certain platform conventions hosting the Markdown. Example: `[{ pattern: /^.attachments/, replacement: "file://some/conventional/folder/.attachments" }]`
  * `ignoreDisable` if this is `true` then disable comments are ignored.
  * `retryOn429` if this is `true` then retry request when response is an HTTP code 429 after the duration indicated by `retry-after` header.
  * `retryCount` the number of retries to be made on a 429 response. Default `2`.
  * `fallbackRetryDelay` the delay in [zeit/ms](https://www.npmjs.com/package/ms) format. (e.g. `"2000ms"`, `20s`, `1m`) for retries on a 429 response when no `retry-after` header is returned or when it has an invalid value. Default is `60s`.
  * `aliveStatusCodes` a list of HTTP codes to consider as alive.
    Example: `[200,206]`
* `callback` function which accepts `(err, results)`.
  * `err` an Error object when the operation cannot be completed, otherwise `null`.
  * `results` an array of objects with the following properties:
    * `link` the `link` provided as input
    * `status` a string set to either `alive`, `ignored` or `dead`.
    * `statusCode` the HTTP status code. Set to `0` if no HTTP status code was returned (e.g. when the server is down).
    * `err` any connection error that occurred, otherwise `null`.

## Examples

### Module

**Basic usage:**

```js
'use strict';

var markdownLinkCheck = require('markdown-link-check');

markdownLinkCheck('[example](http://example.com)', function (err, results) {
    if (err) {
        console.error('Error', err);
        return;
    }
    results.forEach(function (result) {
        console.log('%s is %s', result.link, result.status);
    });
});
```

**With options, for example using URL specific headers:**

```js
'use strict';

var markdownLinkCheck = require('markdown-link-check');

markdownLinkCheck('[example](http://example.com)', { httpHeaders: [{ urls: ['http://example.com'], headers: { 'Authorization': 'Basic Zm9vOmJhcg==' }}] }, function (err, results) {
    if (err) {
        console.error('Error', err);
        return;
    }
    results.forEach(function (result) {
        console.log('%s is %s', result.link, result.status);
    });
});
```

## Test command line

```bash
npx markdown-link-check test/file1.md
npx markdown-link-check --inputs test/file1.md test/file2.md
```

## License

See [LICENSE.md](https://github.com/tcort/markdown-link-check/blob/master/LICENSE.md)
