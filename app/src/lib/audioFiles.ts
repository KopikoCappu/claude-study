import { Directory, File, Paths } from 'expo-file-system';

/**
 * Where note recordings live on Android/iOS: one file per recording in the app's documents folder.
 * Audio is too big for the notes file (which is rewritten on every edit) and isn't uploaded by sync.
 */
const folder = () => {
  const d = new Directory(Paths.document, 'recordings');
  if (!d.exists) d.create();
  return d;
};
const fileFor = (id: string) => new File(folder(), `${id}.m4a`);

/** Move a finished recording (the recorder's temp file) into permanent storage. */
export async function saveAudio(id: string, recorderUri: string): Promise<void> {
  new File(recorderUri).moveSync(fileFor(id), { overwrite: true });
}

/** Something the audio player can open, or null if this device doesn't have the recording. */
export async function audioUri(id: string): Promise<string | null> {
  const f = fileFor(id);
  return f.exists ? f.uri : null;
}

export async function deleteAudio(id: string): Promise<void> {
  const f = fileFor(id);
  if (f.exists) f.delete();
}
