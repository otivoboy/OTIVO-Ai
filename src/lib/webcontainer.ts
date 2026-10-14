import { WebContainer } from '@webcontainer/api';
import { webContainerService } from '../services/webContainerService';
import { transformFilesToWebContainer } from './utils';

export async function getWebContainer(): Promise<WebContainer> {
  return await webContainerService.boot();
}

export function mapFilesToTree(files: any[]) {
  return transformFilesToWebContainer(files);
}

export function onServerReady(callback: (port: number, url: string) => void) {
  getWebContainer().then(instance => {
    if (instance) {
      instance.on('server-ready', callback);
    }
  });
}

export async function mountProject(tree: any) {
  const instance = await getWebContainer();
  if (instance) {
    await instance.mount(tree);
  }
}
