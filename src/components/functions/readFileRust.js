import { invoke } from '@tauri-apps/api';

/**
 * Description placeholder
 *
 * @async
 * @param {*} filePath
 * @returns {unknown}
 */
async function readFile(filePath) {
    try {
        const fileContent = await invoke('read_file', { filePath });
        return fileContent;
    } catch (error) {
        console.error('Error reading file:', error);
    }
}

export default readFile;