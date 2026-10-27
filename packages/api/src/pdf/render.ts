import { createRequire } from "node:module";

import pdfmake from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

const require = createRequire(import.meta.url);

/** Police Roboto livrée avec pdfmake (accents et symboles français compris). */
const fontFile = (name: string) => require.resolve(`pdfmake/fonts/Roboto/${name}`);

let configured = false;

const configure = () => {
  if (configured) {
    return;
  }
  const fonts = {
    Roboto: {
      bold: fontFile("Roboto-Medium.ttf"),
      bolditalics: fontFile("Roboto-MediumItalic.ttf"),
      italics: fontFile("Roboto-Italic.ttf"),
      normal: fontFile("Roboto-Regular.ttf"),
    },
  };
  const allowedFiles = new Set(Object.values(fonts.Roboto));
  pdfmake.setFonts(fonts);
  // Documents 100 % locaux : aucun téléchargement, seules les polices peuvent être lues.
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((file) => allowedFiles.has(file));
  configured = true;
};

export const renderPdf = (definition: TDocumentDefinitions): Promise<Buffer> => {
  configure();
  return pdfmake.createPdf(definition).getBuffer();
};
