import { invoke } from '@tauri-apps/api';

async function clearFile(filePath) {
    try {
        await invoke('clear_file', { filePath });
        return;
    } catch (error) {
        console.error('Error reading file:', error);
    }
}

export default clearFile;