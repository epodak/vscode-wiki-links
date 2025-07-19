import { workspace, Uri } from 'vscode';
import { spawn } from 'child_process';
import { join } from 'path';

export default async function findNonIgnoredFiles(
  pattern: string,
  checkGitIgnore = true
): Promise<Uri[]> {
  const exclude = [
    ...Object.keys((await workspace.getConfiguration('search', null).get('exclude')) || {}),
    ...Object.keys((await workspace.getConfiguration('files', null).get('exclude')) || {}),
  ].join(',');

  const uris = await workspace.findFiles(pattern, `{${exclude}}`);
  if (!checkGitIgnore || uris.length === 0) {
    // --- DIAGNOSTIC LOG ---
    try {
      const fs = require('fs');
      fs.writeFileSync('d:/findNonIgnoredFiles_log_no_git.txt', uris.map(u => u.fsPath).join('\n'));
    } catch(e) { console.error("DIAGNOSTIC LOG FAILED", e); }
    // --- END DIAGNOSTIC LOG ---
    return uris;
  }
  const filteredUris = await filterGitIgnored(uris);
  // --- DIAGNOSTIC LOG ---
  try {
    const fs = require('fs');
    fs.writeFileSync('d:/findNonIgnoredFiles_log_git.txt', filteredUris.map(u => u.fsPath).join('\n'));
  } catch(e) { console.error("DIAGNOSTIC LOG FAILED", e); }
  // --- END DIAGNOSTIC LOG ---
  return filteredUris;
}

async function filterGitIgnored(uris: Uri[]): Promise<Uri[]> {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders) {
    return uris;
  }

  const CHUNK_SIZE = 200; // Process 200 files at a time to be safe
  const ignoredPaths = new Set<string>();

  for (const workspaceDirectory of workspaceFolders) {
    const workspaceDirectoryPath = workspaceDirectory.uri.fsPath;
    
    const urisInWorkspace = uris.filter(uri => uri.fsPath.startsWith(workspaceDirectoryPath));
    if (urisInWorkspace.length === 0) {
      continue;
    }

    const relativePaths = urisInWorkspace.map(uri => workspace.asRelativePath(uri, false));

    for (let i = 0; i < relativePaths.length; i += CHUNK_SIZE) {
      const chunk = relativePaths.slice(i, i + CHUNK_SIZE);
      
      try {
        const stdout = await new Promise<string>((resolve, reject) => {
          const git = spawn('git', ['check-ignore', '--stdin', '-z'], { cwd: workspaceDirectoryPath });
          
          let output = '';
          git.stdout.on('data', (data) => (output += data.toString()));
          git.stderr.on('data', (data) => console.warn(`git stderr: ${data.toString()}`));
          
          git.on('error', reject);
          git.on('close', (code) => {
            // git check-ignore exits with 1 if some files are ignored, 0 if none are, 128 on error.
            if (code === 0 || code === 1) {
              resolve(output);
            } else {
              reject(new Error(`git process exited with code ${code}`));
            }
          });

          // Write paths to stdin, separated by null characters
          git.stdin.write(chunk.join('\0'));
          git.stdin.end();
        });

        if (stdout) {
          const ignored = stdout.split('\0').filter(p => p.length > 0);
          ignored.forEach(p => ignoredPaths.add(join(workspaceDirectoryPath, p)));
        }
      } catch (error) {
        console.error('findNonIgnoredFiles-git-exec-error', error);
        // Continue even if git fails for a chunk
      }
    }
  }

  if (ignoredPaths.size === 0) {
    return uris;
  }

  return uris.filter(uri => !ignoredPaths.has(uri.fsPath));
}
