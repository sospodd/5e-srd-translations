/**
 * Imports
 */

const path = require('path')
const fs = require('fs').promises
const _ = require('lodash')
const { Liquid } = require('liquidjs')
const engine = new Liquid()

const setAsync = async (context, property, pendingValue, localeKey = null) => {
	const value = await pendingValue
	context[property] = localeKey ? { [localeKey]: value } : value
}

/**
 * Working directories
 */

const localesDir = 'dist/locales'
const templatesDir = 'src/templates'
const outputDir = 'src/output'

const isReplacable = (string) => {
	return typeof string === 'string' && string.indexOf('{{') != -1
}

// replace template tags with locale data values using liquidjs
const replace = async (templateData, property, context, localeData, localeKey) => {
	if (isReplacable(templateData)) {
		if (Array.isArray(context)) {
			await setAsync(context, property, engine.parseAndRender(templateData, localeData))
		} else {
			await setAsync(context, property, engine.parseAndRender(templateData, localeData), localeKey)
		}
	}
	return templateData
}

// recursively populate templates with locale data
const populateTemplate = async (templateData, property, context, localeData, localeKey) => {
	if (templateData && Array.isArray(templateData)) {
		for (let i = 0; i < templateData.length; i++) {
			await populateTemplate(templateData[i], i, templateData, localeData, localeKey)
		}
	} else if (templateData && typeof templateData === 'object') {
		for (let key in templateData) {
			if (
				Array.isArray(templateData[key]) &&
                templateData[key].length &&
                templateData[key].every((i) => isReplacable(i))
			) {
				templateData[key] = {
					[localeKey]: templateData[key],
				}

				await populateTemplate(
					templateData[key][localeKey],
					localeKey,
					templateData,
					localeData,
					localeKey
				)
			} else {
				await populateTemplate(
					templateData[key],
					key,
					templateData,
					localeData,
					localeKey
				)
			}
		}
	} else {
		await replace(templateData, property, context, localeData, localeKey)
	}
}

// load locale data from locales directory
async function generateFiles() {
	try {
		// load locale data from locales directory
		const localeFileNames = await fs.readdir(localesDir)

		// get all files in template folder
		const fileNames = await fs.readdir(templatesDir)

		for (const fileName of fileNames) {
			if (!fileName.startsWith('5e-SRD-')) {
				continue
			}

			let fileData = []

			const templateFileContents = await fs.readFile(path.join(templatesDir, fileName))

			for (const localeFileName of localeFileNames) {
				const templateData = JSON.parse(templateFileContents)
				const localeFileContents = await fs.readFile(path.join(localesDir, localeFileName))
				const localeData = JSON.parse(localeFileContents)
				const localeKey = path.parse(localeFileName).name

				// populate and output template to file
				await populateTemplate(templateData, null, null, localeData, localeKey)

				fileData = _.merge(templateData, fileData)
			}

			const outputFileContents = JSON.stringify(fileData, null, 2)
			const outputFileName = path.join(outputDir, `${fileName.split('.')[0]}.json`)

			await fs.writeFile(outputFileName, outputFileContents)
		}
	} catch (error) {
		console.error(error)
	}
}

generateFiles()