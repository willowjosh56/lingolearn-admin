
export async function optimizeCover(
  file: File,
  kind: "desktop" | "mobile"
): Promise<File> {
  let image: ImageBitmap;

  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error(
      "Unable to read this image. Please use a valid PNG, JPG or WebP file."
    );
  }

  try {
    // Maximum image width for each cover type.
    const maxWidth =
      kind === "desktop" ? 1200 : 800;

    // Validate original image dimensions.
    if (
      image.width <= 0 ||
      image.height <= 0
    ) {
      throw new Error(
        "The selected image has invalid dimensions."
      );
    }

    // Resize without enlarging smaller images.
    const scale = Math.min(
      1,
      maxWidth / image.width
    );

    const width = Math.max(
      1,
      Math.round(image.width * scale)
    );

    const height = Math.max(
      1,
      Math.round(image.height * scale)
    );

    // Create canvas.
    const canvas =
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Unable to initialize image compression."
      );
    }

    // Draw resized image.
    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    // Convert image to WebP.
    const blob = await new Promise<Blob>(
      (resolve, reject) => {
        try {
          canvas.toBlob(
            (result) => {
              if (!result) {
                reject(
                  new Error(
                    "Image compression returned no data."
                  )
                );
                return;
              }

              resolve(result);
            },
            "image/webp",
            0.8
          );
        } catch (error) {
          reject(error);
        }
      }
    );

    // Confirm that WebP conversion succeeded.
    // Never upload PNG data disguised as WebP.
    if (blob.type !== "image/webp") {
      throw new Error(
        `WebP conversion failed.
Browser returned: ${blob.type || "unknown"}.
Original size: ${file.size} bytes.
Converted size: ${blob.size} bytes.
Dimensions: ${width} x ${height}.`
      );
    }

    if (blob.size === 0) {
      throw new Error(
        "The converted image is empty."
      );
    }

    // Remove original file extension.
    const filename = file.name.replace(
      /\.[^.]+$/,
      ""
    );

    // Construct optimized WebP file.
    const optimizedFile = new File(
      [blob],
      `${filename}.webp`,
      {
        type: "image/webp",
        lastModified: Date.now(),
      }
    );

    // Diagnostic information.
    console.info(
      "Book cover optimization:",
      {
        originalName: file.name,
        originalType: file.type,
        originalBytes: file.size,
        optimizedName: optimizedFile.name,
        optimizedType: optimizedFile.type,
        optimizedBytes: optimizedFile.size,
        width,
        height,
      }
    );

    return optimizedFile;
  } finally {
    image.close();
  }
}
