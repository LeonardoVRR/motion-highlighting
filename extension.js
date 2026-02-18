// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

/**
 * @type {WeakMap<vscode.TextEditor, {
 *   startLine: number,
 *   lastLine: number,
 *   visibleLines: number
 * }>}
 */

/**
 * @type {WeakMap<vscode.TextDocument, Map<number, {
 *   text: string,
 *   ranges: vscode.Range[]
 * }>>}
 */

let decorators = {};
let tagColors = {};
let viewPortHeight = new WeakMap();
let lineCache = new WeakMap();

const timeoutEditorMap = new WeakMap();
const scrollTimeoutMap = new WeakMap();

function activate(context) {
  let changeEditorTimeout;

  function updateViewport(editor) {
    const visibleRanges = editor.visibleRanges;

    if (!visibleRanges.length) {
      return;
    }

    const startLine = visibleRanges[0].start.line;
    const lastLine = visibleRanges[visibleRanges.length - 1].end.line;
    const visibleLines = lastLine - startLine + 1;

    viewPortHeight.set(editor, {
      startLine,
      lastLine,
      visibleLines,
    });
  }

  function getColorFromTag(tag) {
    const config = vscode.workspace.getConfiguration("motionHighlighting");

    const saturation = config.get("saturation");
    const lightness = config.get("lightness");

    let hash = 0;

    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }

    const color = `hsl(${Math.abs(hash % 360)}, ${saturation}%, ${lightness}%)`;

    return color;
  }

  function computeRanges(currentText, lineNumber, highlightMode = "full") {
    const ranges = {};
    const regex = /(?<=<\/?)(motion\.\w+)(?=[\s>])/g;

    const prefix = "motion";
    const prefixLength = prefix.length;
    const dotLength = 1;

    let startPos;
    let endPos;

    let match;

    regex.lastIndex = 0;

    while ((match = regex.exec(currentText)) !== null) {
      const baseIndex = match.index;
      const fullLength = match[0].length;

      if (highlightMode === "prefix") {
        startPos = new vscode.Position(lineNumber, baseIndex);
        endPos = new vscode.Position(lineNumber, baseIndex + prefixLength);
      } else if (highlightMode === "tagOnly") {
        startPos = new vscode.Position(
          lineNumber,
          baseIndex + prefixLength + dotLength,
        );
        endPos = new vscode.Position(lineNumber, baseIndex + fullLength);
      } else {
        startPos = new vscode.Position(lineNumber, baseIndex);
        endPos = new vscode.Position(lineNumber, baseIndex + fullLength);
      }

      const range = new vscode.Range(startPos, endPos);
      const tag = match[1];

      if (!ranges[tag]) {
        ranges[tag] = [];
      }

      ranges[tag].push(range);
    }

    return ranges;
  }

  function updateDecorations(editor) {
    if (!editor) {
      return;
    }

    const document = editor.document;

    let lineCacheMap = lineCache.get(document);

    if (!lineCacheMap) {
      lineCacheMap = new Map();
      lineCache.set(document, lineCacheMap);
    }

    const config = vscode.workspace.getConfiguration("motionHighlighting");
    const highlightMode = config.get("highlightMode");

    let ranges = {};

    const viewport = viewPortHeight.get(editor);
    if (!viewport) return;
    if (document.lineCount === 0) return;

    const maxLines = editor.document.lineCount - 1;

    let startLine = Math.max(0, viewport.startLine - 5);
    let lastLine = Math.min(maxLines, viewport.lastLine + 5);

    for (let line = startLine; line <= lastLine; line++) {
      const lineText = document.lineAt(line);
      const currentText = lineText.text;

      const cachedLine = lineCacheMap.get(line);

      let lineRanges;

      if (cachedLine && cachedLine.text === currentText) {
        lineRanges = cachedLine.ranges;
      } else {
        lineRanges = computeRanges(currentText, line, highlightMode);

        lineCacheMap.set(line, {
          text: currentText,
          ranges: lineRanges,
        });
      }

      for (const tag in lineRanges) {
        if (!ranges[tag]) {
          ranges[tag] = [];
        }

        ranges[tag].push(...lineRanges[tag]);
      }
    }

    for (const tag in decorators) {
      if (!ranges[tag]) {
        editor.setDecorations(decorators[tag], []);
      }
    }

    for (const tag in ranges) {
      if (!tagColors[tag]) {
        tagColors[tag] = getColorFromTag(tag);
      }

      if (!decorators[tag]) {
        decorators[tag] = vscode.window.createTextEditorDecorationType({
          color: tagColors[tag],
        });
      }

      editor.setDecorations(decorators[tag], ranges[tag] || []);
    }
  }

  if (vscode.window.activeTextEditor) {
    const editor = vscode.window.activeTextEditor;
    const visibleRanges = editor.visibleRanges;

    const startLine = visibleRanges[0].start.line;
    const lastLine = visibleRanges[visibleRanges.length - 1].end.line;
    const visibleLines = lastLine - startLine + 1;

    const maxLine = editor.document.lineCount - 1;

    viewPortHeight.set(editor, {
      startLine,
      lastLine,
      visibleLines,
    });

    updateDecorations(editor);
  }

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) {
      return;
    }

    if (changeEditorTimeout) {
      clearTimeout(changeEditorTimeout);
    }

    changeEditorTimeout = setTimeout(() => {
      const visibleRanges = editor.visibleRanges;

      const startLine = visibleRanges[0].start.line;
      const lastLine = visibleRanges[visibleRanges.length - 1].end.line;
      const visibleLines = lastLine - startLine + 1;

      const maxLine = editor.document.lineCount - 1;

      viewPortHeight.set(editor, {
        startLine,
        lastLine,
        visibleLines,
      });

      updateDecorations(editor);
    }, 50);
  });

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (!event.affectsConfiguration("motionHighlighting")) {
      return;
    }

    for (const tag in decorators) {
      decorators[tag].dispose();
    }

    decorators = {};

    lineCache = new WeakMap();

    if (
      event.affectsConfiguration("motionHighlighting.saturation") ||
      event.affectsConfiguration("motionHighlighting.lightness")
    ) {
      tagColors = {};
    }

    for (const editor of vscode.window.visibleTextEditors) {
      updateViewport(editor);
      updateDecorations(editor);
    }
  });

  vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
    const editor = event.textEditor;

    if (!editor) {
      return;
    }

    const existingTimeout = scrollTimeoutMap.get(editor);

    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const scrollTimeout = setTimeout(() => {
      updateViewport(editor);
      updateDecorations(editor);
    }, 200);

    scrollTimeoutMap.set(editor, scrollTimeout);
  });

  vscode.workspace.onDidChangeTextDocument((event) => {
    const existingTimeout = timeoutEditorMap.get(event.document);

    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      const activeEditor = vscode.window.activeTextEditor;

      if (!activeEditor || activeEditor.document !== event.document) {
        return;
      }

      const lineCacheMap = lineCache.get(event.document);

      if (lineCacheMap) {
        for (const change of event.contentChanges) {
          if (change.text.includes("\n")) {
            lineCache.delete(event.document);
            break;
          }

          const startLine = change.range.start.line;
          const endLine = change.range.end.line;

          for (let line = startLine; line <= endLine; line++) {
            lineCacheMap.delete(line);
          }
        }
      }

      updateDecorations(activeEditor);
    }, 200);

    timeoutEditorMap.set(event.document, timeout);
  });

  vscode.workspace.onDidCloseTextDocument((document) => {
    const existingTimeout = timeoutEditorMap.get(document);

    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    viewPortHeight.delete(document);
    lineCache.delete(document);
    timeoutEditorMap.delete(document);
    scrollTimeoutMap.delete(document);
  });
}

// This method is called when your extension is deactivated
function deactivate() {
  tagColors = {};

  for (const tag in decorators) {
    decorators[tag].dispose();
    delete decorators[tag];
  }
}

module.exports = {
  activate,
  deactivate,
};
