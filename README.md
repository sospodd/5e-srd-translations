# 5e SRD translations
All content in the D&amp;D 5e SRD that can be considered translatable in nested JSON-format.

## Getting started

To be able to run the scripts yourself, first you'll have to run:

`npm install`
or
`yarn install`

## Scripts

### Create source locale

A source locale is a json file containing a collection of everything in the current version of the [5e-database](https://github.com/5e-bits/5e-database) that would be considered translatable. To create the source locale, run:

`npm run create-source-locale`
or
`yarn create-source-locale`

When you create a source locale, you can also create a set of templates containing everything that would not be considered translatable, along with placeholders for the translatable content. To create the source locale and the set of template run:

`npm run create-source-locale --generate-templates`
or
`yarn create-source-locale --generate-templates`

This will create locale (`dist/locales/en/*.json`) and template (`src/templates/*.json`) files for each domain. The contents of the English locale files can then be used as the source locale when translating the content into other languages.

## Format
The translations in this repository are in [Key-Value JSON](https://poeditor.com/localization/files/key-value-json) format.

## License
This project is licensed under the terms of the MIT license. The underlying material is released using the [Open Gaming License Version 1.0a](http://www.opengamingfoundation.org/ogl.html)