# Changes

## [Unreleased][]

## [4.7.0][] - 2021-01-11

### Added

- Restore support of processing stdin
- Restore support of `-a, --alive` option

### Changes

- Update `README.md` to reflect latest improvements

## [4.6.0][] - 2021-01-10

### Changes

- Upate [./README.md] to mention fork and improvements made

## [4.5.0][] - 2020-12-02

### Added

- Add stats `retryCount` in long checks report and in verbose mode
- Add capability to do concurrency checks with `concurrentFileCheck` and `concurrentCheck` options

## [4.4.0][] - 2020-12-02

### Added

- Add command line options `--print-summary`, `--print-cache-stats` and `--print-long-checks` (see [./README.md])

## [4.3.0][] - 2020-12-02

### Added

- Add link cache
- Add statistics

## [4.2.0][] - 2020-12-02

### Added

- Improve statistics reported by the binary

## [4.1.0][] - 2020-12-02

### Added

- Add support for multiple files or URLs
- Rename command line option `--retry` to `--retry-on-429`
- Add command line option `--retry` to `--retry-on-error`
- Remove progress bar option
- Add configuration option `resolveAbsolutePathWithBaseUrl` that allow to resolve absolute path links (like `/page1.md`) related to the `baseUrl` (like `file:///my/wiki`). This is especially usefull when we process several files (in a wiki use case for example).
- Use @boillodmanuel/link-check fork instead of original version. See its [CHANGELOG.md](https://github.com/boillodmanuel/link-check/blob/master/CHANGELOG.md) to get full list of improvements.

## [4.0.3][] - 2020-12-01

### Added

- Release on new tag with github action

## [4.0.0][] - 2020-12-01

- Starting point of this fork (`@boillodmanuel`)
- Migration to typescript

## Version 3.8.3

* update dependencies (Fixes #86)

## Version 3.8.2

* update dependencies

## Version 3.8.1

* update dependencies
* Remove unnecessary files in the package published to npmjs #92

## Version 3.8.0

* update dependencies #81
* Surface dead links in results output #82
* Add support for disable comments #83
* Suggest `--save-dev` rather than `--save` in `README.md` #63

## Version 3.7.3

* update dependencies #74

## Version 3.7.2

* Fix fs access anti pattern #62

## Version 3.7.1

* Fix accessing fs.constants.F_OK #58

## Version 3.7.0

* Add verbose mode for showing detailed error information #55
* Fix issue with fs constants #53
* Fix invalid argument errors #54

## Version 3.6.2

* fix crash when 1st link is ignored/replaced

## Version 3.6.1

* ignore query string in links to local files

## Version 3.6.0

* replacement patterns

## Version 3.5.5

* better handling of malformed URLs and unsupported protocols.
* support RFC6068 style hfields in mailto: links.

## Version 3.5.4

* update markdown-link-extractor dependency to support image links with image size attributes

## Version 3.5.3

* docker run fixes

## Version 3.5.2

* support for parentheses in URLs

## Version 3.5.1

* don't show 'No hyperlinks found!' when quiet

## Version 3.5.0

* introduce `--quiet` mode that displays errors (dead links) only
* support for ignore patterns to skip the link check for certain links

## Version 3.4.0

* support for providing custom HTTP headers

## Version 3.3.1

* update dependencies to avoid CVE-2018-3728


[Unreleased]: https://github.com/boillodmanuel/markdown-link-check/compare/v4.7.0...HEAD
[4.7.0]: https://github.com/boillodmanuel/markdown-link-check/compare/v4.6.0...v4.7.0
[4.6.0]: https://github.com/boillodmanuel/markdown-link-check/compare/v4.5.0...v4.6.0
[4.5.0]: https://github.com/boillodmanuel/markdown-link-check/compare/v4.4.0...v4.5.0
[4.4.0]: https://github.com/boillodmanuel/markdown-link-check/compare/v4.3.0...v4.4.0
[4.3.0]: https://github.com/boillodmanuel/markdown-link-check/compare/v4.2.0...v4.3.0
[4.2.0]: https://github.com/boillodmanuel/markdown-link-check/compare/v4.1.0...v4.2.0
[4.1.0]: https://github.com/boillodmanuel/markdown-link-check/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/boillodmanuel/markdown-link-check/compare/v3.8.3...v4.0.0