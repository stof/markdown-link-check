Contributing
============

## Fork

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

## Test command line

```bash
npx ts-node src/bin/markdown-link-check.ts test/file1.md
npx ts-node src/bin/markdown-link-check.ts --inputs test/file1.md test/file2.md
```


# Testing

```shell
npm test
```


# Release


Tag a new version with:

```bash
npm version major|minor|patch
```

Then github action will publish the tag and create a new release