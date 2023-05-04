![English](https://img.shields.io/poeditor/progress/540871/en?token=dc47828eea9f57141ee613a9ebd5f37a)
![Swedish](https://img.shields.io/poeditor/progress/540871/sv?token=dc47828eea9f57141ee613a9ebd5f37a)

# 5e SRD translations

All content in the D&amp;D 5e SRD that can be considered translatable in Key-Value JSON-format.

## Contribute

If you want to help out with translations in an existing language or suggest a new one, please check out [this project on POEditor](https://poeditor.com/join/project/VRCyPrP4qH).

## Getting started

To be able to run the scripts yourself, first you'll have to run:

```
npm install
```
or
```
yarn install
```

## Scripts

### Create source locale

A source locale is a json file containing a collection of everything in the current version of the [5e-database](https://github.com/5e-bits/5e-database) that would be considered translatable. To create the source locale, run:

```
npm run create-source-locale
```
or
```
yarn create-source-locale
```

When you create a source locale, you can also create a set of templates containing everything that would not be considered translatable, along with placeholders for the translatable content. To create the source locale and the set of template run:


```
npm run create-source-locale --generate-templates
```
or
```
yarn create-source-locale --generate-templates
```

This will create locale (`dist/locales/en/*.json`) and template (`src/templates/*.json`) files for each domain. The contents of the English locale files can then be used as the source locale when translating the content into other languages.

## Known issues
1. Traits: There's a duplicate entry for each color of Draconic Ancestry and they in turn have a duplicate of the Breath Weapon trait in the locale. Logic similar to that in Features (ignore parenthesized suffix in key) should be used here as well.
2. Monsters: Equipment types `melee`, `ability` and `ranged` have mistakenly been added to monster types. Regex needs to be improved.
3. Classes: Newly added proficiency choice and starting equipment descriptions should be added to the `common` domain to prevent duplicates and make for a more desirable translation path.
4. Features: Some of the translation paths for subfeature options (such as fightling style and dragon ancestor) are incorrect, resulting in empty entries for source language (`"en": ""`) when populating the templates.
5. Subclasses: Translation paths for level prerequisites are incorrect, resulting in empty entries for source language (`"en": ""`) when populating the templates.
6. Documentation: Populate templates feature is currently undocumented

## Format

The translations in this repository are in [Key-Value JSON](https://poeditor.com/localization/files/key-value-json) format.

## License

This project is licensed under the terms of the MIT license. The underlying material is released using the [Open Gaming License Version 1.0a](http://www.opengamingfoundation.org/ogl.html)
