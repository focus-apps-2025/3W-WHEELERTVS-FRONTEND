/**
 * Utility to compress images client-side before upload to prevent UI lag,
 * reduce bandwidth, and eliminate upload timeouts.
 */
export const compressImage = async (
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.82
): Promise<File> => {
  // Only compress images (skip GIFs, SVGs, or non-image files)
  if (
    !file ||
    !file.type ||
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    return file;
  }

  // If file is already smaller than 300KB, no need to compress
  if (file.size < 300 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Calculate new dimensions preserving aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return resolve(file);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // If compression didn't reduce file size, return original file
            return resolve(file);
          }

          const compressedName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
          const compressedFile = new File([blob], compressedName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          console.log(
            `⚡ [Image Compressor] Optimized "${file.name}": ${(
              file.size /
              1024 /
              1024
            ).toFixed(2)}MB ➔ ${(compressedFile.size / 1024 / 1024).toFixed(
              2
            )}MB (${width}x${height})`
          );

          resolve(compressedFile);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = (err) => {
      console.warn("Image compression failed, falling back to original file:", err);
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
};
