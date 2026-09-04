"use client";

import { useRef, useState } from "react";

// Must match MAX_AVATAR_BYTES in lib/actions/profile.ts — kept as a
// last-resort check even though compression below should always land
// well under it.
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.8;

// Resizes to MAX_DIMENSION on the longest side and re-encodes as JPEG —
// a phone photo of several MB typically comes out under a few hundred
// KB, since the avatar is only ever displayed at 64px.
async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no soportado");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo comprimir la imagen"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

export function AvatarUploadField() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  function finishSelection(file: File, input: HTMLInputElement) {
    if (file.size > MAX_AVATAR_BYTES) {
      setError("La foto no puede superar 5 MB. Elige una imagen más liviana.");
      setFileName(null);
      input.value = "";
      return;
    }
    setFileName(file.name);
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const input = e.target;
    if (!file) {
      setFileName(null);
      setError(null);
      return;
    }

    setError(null);
    setFileName(null);

    // Animated GIFs would lose their animation if re-encoded as a
    // static JPEG — upload those as-is, still subject to the size check.
    if (file.type === "image/gif") {
      finishSelection(file, input);
      return;
    }

    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      const dt = new DataTransfer();
      dt.items.add(compressed);
      input.files = dt.files;
      finishSelection(compressed, input);
    } catch {
      // Compression unsupported or failed (old browser, corrupt file) —
      // fall back to uploading the original file.
      finishSelection(file, input);
    } finally {
      setCompressing(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="text-charcoal/50">Foto de perfil</span>
      <label
        htmlFor="avatar"
        className="w-fit cursor-pointer rounded-full border border-charcoal/20 px-4 py-1.5 text-sm text-charcoal transition-colors hover:border-gold hover:bg-gold/10"
      >
        Subir foto
      </label>
      <input
        ref={inputRef}
        id="avatar"
        type="file"
        name="avatar"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {compressing && <p className="text-xs text-charcoal/50">Comprimiendo…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {fileName && !error && !compressing && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-[12rem] truncate text-xs text-charcoal/60">{fileName}</span>
          <button
            type="button"
            onClick={() => inputRef.current?.form?.requestSubmit()}
            className="rounded-full bg-charcoal px-3 py-1.5 text-xs text-white transition-colors hover:bg-gold hover:text-charcoal"
          >
            Cargar foto
          </button>
        </div>
      )}
    </div>
  );
}
