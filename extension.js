// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	let timeout

	const decorators = {}

	function getColorFromTag(tag) {
		let hash = 0

		for (let i = 0; i < tag.length; i++) {
			hash = tag.charCodeAt(i) + ((hash << 5) - hash)
		}

		const color = `hsl(${Math.abs(hash % 360)}, 70%, 60%)`

		return color
	}

	function updateDecorations(editor) {

		if (!editor) { return }

		const document = editor.document
		const text = document.getText()
		const regex = /motion\.(\w+)/g

		if (!(text.includes("motion.")) || text.length === 0) { return }

		const ranges = {};

		let match;

		for (const tag in decorators) {
			editor.setDecorations(decorators[tag], [])
		}

		while ((match = regex.exec(text)) !== null) {
			const startPos = document.positionAt(match.index)
			const endPos = document.positionAt(match.index + match[0].length)

			const range = new vscode.Range(startPos, endPos)

			const tag = match[1]

			if (!decorators[tag]) {

				decorators[tag] = vscode.window.createTextEditorDecorationType({
					color: getColorFromTag(tag),
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

	vscode.workspace.onDidChangeTextDocument(event => {
		const editor = vscode.window.activeTextEditor

		if (editor && event.document === editor.document) {
			updateDecorations(editor)

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
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
