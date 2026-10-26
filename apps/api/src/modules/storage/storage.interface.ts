export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface StorageService {
  /**
   * Salva um arquivo e retorna o caminho de storage
   * @param buffer Buffer do arquivo
   * @param fileName Nome original do arquivo
   * @param mimeType Tipo MIME do arquivo
   * @returns Caminho de storage (usado para recuperação posterior)
   */
  saveFile(buffer: Buffer, fileName: string, mimeType: string): Promise<string>;

  /**
   * Recupera um arquivo pelo caminho de storage
   * @param storagePath Caminho de storage retornado por saveFile
   * @returns Buffer do arquivo e metadados
   */
  getFile(storagePath: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }>;

  /**
   * Remove um arquivo do storage
   * @param storagePath Caminho de storage
   */
  deleteFile(storagePath: string): Promise<void>;

  /**
   * Verifica se um arquivo existe
   * @param storagePath Caminho de storage
   */
  fileExists(storagePath: string): Promise<boolean>;
}

export interface FileMetadata {
  fileName: string;
  mimeType: string;
  size: number;
}
