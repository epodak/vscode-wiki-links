import * as vscode from 'vscode';

export interface WikiLinkRef {
  type: 'WikiLink' | 'Null';
  word: string;
  range: vscode.Range | undefined;
}

export const NULL_WIKI_LINK_REF: WikiLinkRef = {
  type: 'Null',
  word: '',
  range: undefined,
};

export function getWikiLinkOrEmptyAt(document: vscode.TextDocument, position: vscode.Position): WikiLinkRef {
  const lineText = document.lineAt(position.line).text;
  const textBeforeCursor = lineText.substring(0, position.character);

  const linkStartPos = textBeforeCursor.lastIndexOf('[[');
  
  // No opening brackets before cursor, not a link
  if (linkStartPos === -1) {
    return NULL_WIKI_LINK_REF;
  }

  const textAfterLinkStart = textBeforeCursor.substring(linkStartPos);
  
  // Check if there's a complete wiki link (with ]] ) before the cursor
  // If so, we are NOT inside an active wiki link
  if (textAfterLinkStart.includes(']]')) {
    return NULL_WIKI_LINK_REF;
  }

  const word = textAfterLinkStart.substring(2); // Get the text between "[[" and cursor

  // Define the range of the text to be replaced on completion.
  // It starts right after the "[[" and ends at the cursor.
  const start = new vscode.Position(position.line, linkStartPos + 2);
  const end = position;
  const range = new vscode.Range(start, end);

  return {
    type: 'WikiLink',
    word: word,
    range: range,
  };
} 