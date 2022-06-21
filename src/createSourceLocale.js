/**
 * Imports
 */

var fs = require('fs').promises
var _ = require('lodash')

/**
 * Arguments
 */

var args = process.argv.slice(2)

/**
 * Prototype functions
 */

Number.prototype.toVariable = function() {
	return ((this + 23) % 26 + 10).toString(36)
}

String.prototype.sanitize = function() {
	return this
		.split(/ |\//)
		.filter(string => string)
		.splice(0, 10)
		.join('_')
		.replace(/[\W/]+/g, '')
		.toLowerCase()
}

String.prototype.replaceWithVariables = function(match, placeholderOpen = '', placeholderClose = '') {
	let i = 0

	return this
		.replace(match, function() {
			const letter = i.toVariable()
			i++
			return `${placeholderOpen}${letter}${placeholderClose}`
		})
}

Array.prototype.makeCommaSeparatedString = function(useOxfordComma) {
	const listStart = this.slice(0, -1).join(', ')
	const listEnd = this.slice(-1)
	const conjunction = this.length <= 1 
		? '' 
		: useOxfordComma && this.length > 2 
			? '{{ common.delimiters.and_with_oxford_comma }}' 
			: '{{ common.delimiters.and }}'

	return [listStart, listEnd].join(conjunction)
}

/**
 * Class
 */

class CreateSourceLocale {
	constructor() {
		this.options = {
			generateTemplates: args.find(arg => arg === '--generate-templates'),
		}

		// set source folder path
		this.sourcePath = 'node_modules/5e-database/src'

		// set up object for all translation values and keys that we can use to identify duplicates
		this.potentialDuplicates = {}

		// set up categorized regexes for paths to ignore per domain
		this.pathsToIgnore = [
			// general
			/(index|url)$/,

			// ability scores
			/^ability_scores\.\d+\.skills$/,

			// backgrounds
			/^backgrounds\.([a-z_.\d]+)(starting_proficiencies|language_options|starting_equipment|starting_equipment_options|choose|type|alignments)$/,

			// classes
			/^classes\.([a-z_.\d]+)(hit_die|proficiency_choices|proficiencies|saving_throws|starting_equipment|starting_equipment_options|class_levels|multi_classing|subclasses|level|spellcasting_ability|spells)$/,

			// equipment categories
			/^equipment_categories\.([a-z_.\d]+)equipment$/,

			// equipment
			/^equipment\.([a-z_.\d]+)(equipment_category|cost\.quantity|damage|properties|armor_class|str_minimum|stealth_disadvantage|properties|speed\.quantity|weapon_category|weight|armor_category|gear_category|contents|tool_category|vehicle_category)$/,

			// feats
			/^feats\.([a-z_.\d]+)prerequisites$/,

			// features
			/^features\.([a-z_.\d]+)(class|level|feature_specific|parent|prerequisites|reference)$/,

			// magic items
			/^magic_items\.([a-z_.\d]+)(equipment_category|variant|variants)$/,

			// monsters
			/^monsters\.([a-z_.\d]+)(attack_options|challenge_rating|condition_immunities|damage|dc|options\.from\.[\d.]+\.type|proficiencies|spellcasting)$/,

			// proficiencies
			/^proficiencies\.([a-z_.\d]+)(type|classes|races|reference)$/,

			// races
			/^races\.([a-z_.\d]+)(ability_bonuses|starting_proficiencies|starting_proficiency_options|languages|traits|subraces|language_options|ability_bonus_options)$/,

			// rules
			/^rules\.([a-z_.\d]+)subsections$/,

			// skills
			/^skills\.([a-z_.\d]+)ability_score$/,

			// spells
			/^spells\.([a-z_.\d]+)(ritual|concentration|damage|school|classes|subclasses|dc_type)$/,

			// subclasses
			/^subclasses\.([a-z_.\d]+)(class|subclass_flavor|subclass_levels|spells)$/,

			// races
			/^subraces\.([a-z_.\d]+)(race|ability_bonuses|racial_traits|starting_proficiencies|language_options)$/,

			// traits
			/^traits\.([a-z_.\d]+)(races|proficiencies|proficiency_choices|trait_specific|parent)$/
		]

		this.valuesToIgnore = [
			/^\d+$/,
			/^([0-9]|[1-9][0-9])?d(|4|6|8|10|12|20|1)((\+|-)([0-9]|[1-9][0-9]))?$/,
			/^true$/,
			/^$/,
		]

		this.measurementsRegex = /\.(blindsight|capacity|casting_time|darkvision|duration|range|count|size|tremorsense|truesight|unit|speed\.(burrow|climb|fly|swim|walk))$/

		// set up object to store locale data in
		this.localeData = {
			common: {
				delimiters: {
					and: ' and ',
					and_with_oxford_comma: ', and ',
				},
			}
		}

		this.templateData = {}

		this.placeholderOpen = '{{ '
		this.placeholderClose = ' }}'
	}

	/**
	 * iterate through and process source all files
	 */

	init = async () => {
		// get all files in 5e database source folder
		const allFileNames = await fs.readdir(this.sourcePath)

		// filter and sort source file names
		this.sourceFileNames = this.filterAndSortFileNames(allFileNames)

		// get domains from file names
		this.domains = this.getDomainsFromFileNames(this.sourceFileNames)

		const filesToProcess = await this.sourceFileNames.map(
			async (sourceFileName, sourceFileIndex) => {
				return await this.processSourceFile(sourceFileName, sourceFileIndex)
			}
		)

		console.log('Generating source locales from 5e-database')

		if (this.options.generateTemplates) {
			console.log('Generating 5e-database templates')
		}
		
		Promise.all(filesToProcess).then(() => {
			this.outputSourceLocale(
				this.localeData,
				this.options.generateTemplates
					? this.templateData
					: null
			)
		})
	}

	/**
	 * format placeholder
	 * 
	 * @param path
	 * @param filterSuffix
	 */

	formatPlaceholder(path, filterSuffix = '') {
		return `${this.placeholderOpen}${path}${filterSuffix}${this.placeholderClose}`
	}

	/**
	 * filter out non source files and save traits and monsters for last
	 * to make duplicate prevention result in more desirable keys
	 *
	 * @param fileNames
	 */

	filterAndSortFileNames = (fileNames) => {
		return fileNames
			.filter(fileName => fileName.startsWith('5e-SRD-') && fileName !== '5e-SRD-Levels.json')
			.sort((a) => {
				if (a.match(/Monsters|Traits|Proficiencies/)) {
					return 1
				} else if (a.match(/Magic-Schools/)) {
					return -1
				}

				return 0
			})
	}

	/**
	 * get domains by parsing file names
	 *
	 * @param fileNames
	 */

	getDomainsFromFileNames = (fileNames) => {
		return fileNames.map(fileName =>
			fileName
				.replace('5e-SRD-', '')
				.replace('.json', '')
				.split('-')
				.join('_')
				.toLowerCase()
		)
	}

	/**
	 * process source file
	 *
	 * @param sourceFileName
	 * @param sourceFileIndex
	 */

	processSourceFile = async (sourceFileName, sourceFileIndex) => {
		const sourceFileContents = await fs.readFile(`${this.sourcePath}/${sourceFileName}`)
		const sourceFileData = JSON.parse(sourceFileContents)
		const domain = this.domains[sourceFileIndex]

		if (this.options.generateTemplates) {
			this.templateData[sourceFileName.split('.')[0]] = sourceFileData
		}

		console.log(`Processing ${domain}...`)
		
		return await this.parseSourceFileData(sourceFileData, null, sourceFileData, domain)
	}

	/**
	 * prettify path for locale data
	 *
	 * @param path
	 * @param sourceFileData
	 */

	prettifyPath = (path, sourceFileData, data) => {
		let pathParts = path.split('.')
		let lastPart = pathParts[pathParts.length - 1]

		// replace numeric indeces with name based ones for monster actions
		if (path.match(/(special_abilities|actions|reactions|legendary_actions|spellcasting\.info)\.\d+\.(name|desc|desc\.\d+)$/)) {
			const pathToName = [...pathParts.slice(1, pathParts.length - (path.match(/desc\.\d+$/) ? 2 : 1)), 'name'].join('.')

			if (_.has(sourceFileData, pathToName)) {
				pathParts[pathParts.length - (path.match(/desc\.\d+$/) ? 3 : 2)] = _.get(sourceFileData, pathToName).sanitize()
			}
		}

		// replace numeric indeces with name based ones for root level of all domains
		if (path.match(/^[a-z_]+\.\d+\.[a-z_]+/)) {
			const pathToItem = pathParts.slice(1, 2).join('.')

			let textIndex

			if (path.match(/^ability_scores\./)) {
				// for ability scores, use sanitized full name instead of abbreviated
				textIndex = _.get(sourceFileData, `${pathToItem}.full_name`).sanitize()
			} else {
				textIndex = _.get(sourceFileData, `${pathToItem}.index`)
			}

			// replace number (second path part) with index key
			pathParts[1] = textIndex
		}

		// ability scores
		if (path.match(/^ability_scores\./)) {
			const keyReplacements = {
				name: 'abbreviation',
				full_name: 'name'
			}

			pathParts = [
				...pathParts.slice(0, pathParts.length - 1),
				!lastPart.match(/\d+/)
					? keyReplacements[lastPart]
					: lastPart
			]
		}

		// measurements
		if (path.match(this.measurementsRegex)) {
			pathParts = [
				'common',
				'measurements',
				path.match(/speed\.(burrow|climb|fly|swim|walk)$/)
					? 'speed'
					: lastPart,
				data.sanitize()
			]
		}

		// equipment properties
		if (path.match(/\.(armor_category|category_range|tool_category|vehicle_category|weapon_category|weapon_range|rarity\.name)$/)) {
			pathParts = [
				'common',
				'equipment_properties',
				path.match(/\.rarity\.name$/)
					? 'rarity'
					: lastPart,
				data.sanitize()
			]
		}

		// monster properties
		if (
			path.match(/^monsters\.\d+\.(alignment|damage_immunities\.\d+|damage_resistances\.\d+|damage_vulnerabilities\.\d+|languages|subtype|type)$/) ||
						path.match(/^monsters\.([a-z_.\d]+)(options\.from\.[\d.]+\.name|usage\.type|usage\.rest_types\.\d+|notes)$/)
		) {
			let thirdPart = lastPart

			if (path.match(/usage\.type$/)) {
				thirdPart = 'usage_types'
			} else if (path.match(/rest_types\.\d+$/)) {
				thirdPart = 'rest_types'
			} else if (path.match(/options\.from\.[\d.]+\.name$/)) {
				thirdPart = 'action_options'
			} else if (path.match(/damage_immunities\.\d+|damage_resistances\.\d+|damage_vulnerabilities\.\d+/)) {
				thirdPart = 'damage_types'
			} else if (path.match(/notes$/)) {
				thirdPart = 'notes'
			}

			pathParts = [
				'common',
				'monster_properties',
				thirdPart,
				data.sanitize()
			]
		}

		// language properties
		if (path.match(/^languages\.([a-z_.\d]+)(type|script|typical_speakers|typical_speakers\.\d+)$/)) {
			pathParts = [
				'common',
				'language_properties',
				path.match(/typical_speakers\.\d+$/)
					? pathParts[pathParts.length - 2]
					: lastPart,
				data.sanitize()
			]
		}

		// spell properties
		if (path.match(/spells\.([a-z_.\d]+)(area_of_effect\.type|components\.\d+|dc_success|material|attack_type)/)) {
			pathParts = [
				'common',
				'spell_properties',
				path.match(/(area_of_effect\.type|components\.\d+)$/)
					? pathParts[pathParts.length - 2]
					: lastPart,
				data.sanitize()
			]
		}

		pathParts = pathParts.filter(pathPart => !['from', 'info'].includes(pathPart))

		path = pathParts.join('.')

		return path
			.split('-')
			.join('_')
	}

	/**
	 * parse source file data
	 *
	 * @param data
	 * @param property
	 * @param sourceFileData
	 * @param path
	 */

	parseSourceFileData = async (data, property, sourceFileData, path) => {
		path = [
			...path.split('.'),
			...(!property && property !== 0 ? [] : [property])
		]
			.join('.')

		if (this.pathsToIgnore.find(pathRegex => path.match(pathRegex))) {
			return
		}

		// source file data will contain everything we need to get domain and realPath, no need to pass those)
		if (data && Array.isArray(data)) {
			// handle array
			await Promise.all(data.map(
				(item, index) => this.parseSourceFileData(item, index, sourceFileData, path)
			))
		} else if (data && typeof data === 'object') {
			// handle object
			await Promise.all(Object.keys(data).map(key => {
				return this.parseSourceFileData(data[key], key, sourceFileData, path)
			}))
		} else {
			const valueForLocale = data
			let valueForTemplate
			// handle other types
			if (this.valuesToIgnore.find(valueRegex => valueForLocale.toString().match(valueRegex))) {
				return
			}

			if (path.match(/^monsters\.([a-z_.\d]+)(damage_resistances\.\d+|damage_vulnerabilities\.\d+|damage_immunities\.\d+|languages)$/)) {
				// handle everything that is potentially a comma separated list
				const promises = []
				const hasAnd = / and /.test(valueForLocale)
								
				// determine if list contains `and with oxford comma`
				const hasOxfordComma = /, and /.test(valueForLocale)
				
				// split list by `and with oxford comma`, `and` and `comma` and parse results
				const placeholders = valueForLocale.split(/, and | and |, /g)
					.map(result => {
						promises.push(
							Promise.resolve(
								_.setWith(
									this.localeData,
									this.prettifyPath(path, sourceFileData, result),
									result,
									Object
								)
							)
						)

						return this.formatPlaceholder(
							this.prettifyPath(path, sourceFileData, result)
						)
					})

				await Promise.all(promises)

				if (this.options.generateTemplates) {
					if (hasAnd) {
						valueForTemplate = placeholders
						// set value to comma/and separated string of formatted placeholders (with conditional oxford comma)
							.makeCommaSeparatedString(hasOxfordComma)
					} else {
						// set value to comma separated string of formatted placeholders
						valueForTemplate = placeholders.join(', ')
					}
				}
			} else if (path.match(this.measurementsRegex)) {
				// handle everything that we'll consider `measurement` related

				// determine if there are any numeric values in valueForLocale
				const numberRegex = /(\d*\.?\d+|\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?!\S)/g
				const matches = Array.from(valueForLocale.matchAll(numberRegex), i => i[0])

				// replace any numeric values in template key with incrementing variables
				const keyWithVariables = valueForLocale.replaceWithVariables(numberRegex).sanitize()

				// replace any numeric values in value with incrementing variables
				const dataWithVariables = valueForLocale.replaceWithVariables(numberRegex, this.placeholderOpen, this.placeholderClose)

				// for each matching numeric value, add a replace filter with variable and captured number
				const filterSuffix = matches.length
					? matches
						.map((match, matchIndex) => {
							return ` | replace: '${this.placeholderOpen}${matchIndex.toVariable()}${this.placeholderClose}', '${match}'`
						})
						.join('')
					: ''

				// alter path before sending it to prettifyPath if value matches with unit condition
				const potentiallyAlteredPath = this.prettifyPath(
					matches.length
						? `common.measurements.with_unit.${keyWithVariables}`
						: path,
					sourceFileData,
					dataWithVariables
				)
								
				// set locale data
				await Promise.resolve(
					_.setWith(
						this.localeData,
						potentiallyAlteredPath,
						dataWithVariables,
						Object
					)
				)

				if (this.options.generateTemplates) {
					valueForTemplate = this.formatPlaceholder(
						potentiallyAlteredPath,
						filterSuffix
					)
				}
			} else {
				const prettifiedPath = this.prettifyPath(path, sourceFileData, valueForLocale)

				await Promise.resolve(
					_.setWith(
						this.localeData,
						prettifiedPath,
						valueForLocale,
						Object
					)
				)

				if (this.options.generateTemplates) {
					valueForTemplate = this.formatPlaceholder(prettifiedPath)
				}
			}

			const currentFileName = this.sourceFileNames[
				this.domains.indexOf(path.split('.')[0])
			].split('.')[0]

			const templatePath = [
				currentFileName,
				...path.split('.').slice(1)
			].join('.')

			if (this.options.generateTemplates) {
				// set valueForTemplate as value in this.templateData by path
				await Promise.resolve(
					_.set(
						this.templateData,
						templatePath,
						valueForTemplate
					)
				)
			}
		}
	}

	/**
	 * write source locale to file
	 *
	 * @param localeData
	 */

	outputSourceLocale = async (localeData, templateData = null) => {
		const sortedLocaleData = Object.keys(localeData).sort().reduce(
			(obj, key) => {
				obj[key] = localeData[key]
				return obj
			},
			{}
		)

		const localeOutput = JSON.stringify(sortedLocaleData, null, 2)

		// write translations data for each domain to dist file in default locale folder
		await fs.writeFile(
			'dist/locales/en.json',
			localeOutput,
			'utf8',
			e => e ? console.error(e) : null
		)

		if (templateData) {
			for (const [key, value] of Object.entries(templateData)) {
				const templateOutput = JSON.stringify(value, null, 2)
								
				// write template data to files in src templates folder with original filenames
				await fs.writeFile(
					`src/templates/${key}.json`,
					templateOutput,
					'utf8',
					e => e ? console.error(e) : null
				)
			}
		}
	}
}

const createSourceLocale = new CreateSourceLocale

createSourceLocale.init()