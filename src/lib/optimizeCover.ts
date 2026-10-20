
export async function optimizeCover(
  file: File,
  kind: "desktop" | "mobile"
): Promise<File> {
  const image = await createImageBitmap(file);

  try {
    const maxWidth = kind === "desktop" ? 1200 : 800;

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

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Unable to initialize image compression."
      );
    }

    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    const blob = await new Promise<Blob>(
      (resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(
                new Error("Image compression failed.")
              );
              return;
            }

            resolve(result);
          },
          "image/webp",
          0.8
        );
      }
    );

    if (blob.type !== "image/webp") {
      throw new Error(
        "Your browser could not create a WebP image."
      );
    }

    const filename = file.name.replace(
      /\.[^.]+$/,
      ""
    );

    return new File(
      [blob],
      `${filename}.webp`,
      {
        type: "image/webp",
      }
    );
  } finally {
    image.close();
  }
}
