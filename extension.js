// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

const decorators = {}
let tagColors = {}

function activate(context) {

	let timeout

	const prefix = "motion"
	const prefixLength = prefix.length
	const dotLength = 1

	function getColorFromTag(tag) {

		const config = vscode.workspace.getConfiguration('motionColorizer')

		const saturation = config.get('saturation')
		const lightness = config.get('lightness')

		let hash = 0

		for (let i = 0; i < tag.length; i++) {
			hash = tag.charCodeAt(i) + ((hash << 5) - hash)
		}

		const color = `hsl(${Math.abs(hash % 360)}, ${saturation}%, ${lightness}%)`

		return color
	}

	function updateDecorations(editor) {

		if (!editor) { return }

		const config = vscode.workspace.getConfiguration('motionColorizer')
		const highlightMode = config.get("highlightMode")

		const document = editor.document
		const text = document.getText()
		const regex = /(?<=<\/?)(motion\.\w+)(?=[\s>])/g

		if (!text.includes("motion.")) { return }

		const ranges = {};

		let match;

		for (const tag in decorators) {
			editor.setDecorations(decorators[tag], [])
		}

		let startPos
		let endPos

		while ((match = regex.exec(text)) !== null) {

			const baseIndex = match.index
			const fullLength = match[0].length

			if (highlightMode === "prefix") {
				startPos = document.positionAt(baseIndex)
				endPos = document.positionAt(baseIndex + prefixLength)
			}

			else if (highlightMode === "tagOnly") {
				startPos = document.positionAt(baseIndex + prefixLength + dotLength)
				endPos = document.positionAt(baseIndex + fullLength)
			}

			else {
				startPos = document.positionAt(baseIndex)
				endPos = document.positionAt(baseIndex + fullLength)
			}

			const range = new vscode.Range(startPos, endPos)
			const tag = match[1]

			if (!tagColors[tag]) {
				tagColors[tag] = getColorFromTag(tag)
			}

			if (!decorators[tag]) {

				decorators[tag] = vscode.window.createTextEditorDecorationType({
					color: tagColors[tag],
				})
			}

			if (!ranges[tag]) {
				ranges[tag] = []
			}

			ranges[tag].push(range)
		}

		for (const tag in ranges) {
			editor.setDecorations(decorators[tag], ranges[tag])
		}
	}

	if (vscode.window.activeTextEditor) {
		updateDecorations(vscode.window.activeTextEditor)
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		updateDecorations(editor)
	})

	vscode.workspace.onDidChangeConfiguration((event) => {

		if (!event.affectsConfiguration("motionColorizer")) { return }

		for (const tag in decorators) {
			decorators[tag].dispose()
			delete decorators[tag]
		}

		if (event.affectsConfiguration("motionColorizer.saturation") ||
			event.affectsConfiguration("motionColorizer.lightness")) {
			console.log("Cor alterada")
			tagColors = {}
		}

		for (const editor of vscode.window.visibleTextEditors) {
			updateDecorations(editor)
		}
	})

	vscode.workspace.onDidChangeTextDocument(event => {
		const editor = vscode.window.activeTextEditor

		if (editor && event.document === editor.document) {

			if (timeout) {
				clearTimeout(timeout)
			}

			timeout = setTimeout(() => {
				updateDecorations(editor)
			}, 200)
		}
	})
}

// This method is called when your extension is deactivated
function deactivate() {
	for (const tag in decorators) {
		decorators[tag].dispose()
		delete decorators[tag]
	}

	for (const tag in tagColors) {
		delete tagColors[tag]
	}
}

module.exports = {
	activate,
	deactivate
}
