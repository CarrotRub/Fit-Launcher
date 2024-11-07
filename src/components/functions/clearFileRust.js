//TODO - Still needs to be tested
// import { invoke } from '@tauri-apps/api';

// async function clearFile(filePath) {
//     try {
//         await invoke('clear_file', { file_path: filePath });
//         console.log(`File cleared: ${filePath}`);
//     } catch (error) {
//         console.error('Error clearing file:', error);
//     }
// }

// export default clearFile;

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