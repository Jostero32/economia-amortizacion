# Modelo OCR para la MRZ

`mrz.traineddata`: modelo de Tesseract entrenado para la zona de lectura mecánica (MRZ) de documentos
de identidad. Lo usa `src/services/identity/mrzService.js` para leer el reverso de la cédula.

- Origen: [DoubangoTelecom/tesseractMRZ](https://github.com/DoubangoTelecom/tesseractMRZ),
  `tessdata_fast/mrz.traineddata`, commit `0f039b6d18a4a0e7adb0b4841a8732e200b8d968`.
- SHA-256: `ece2a54f125a73792f9cec74e6f8e62f6e5e00c7f19153ba865af689be5b5f01`.
- Licencia: BSD 3-Clause, en [LICENSE-tesseractMRZ](LICENSE-tesseractMRZ).
- Por qué este modelo: con cédulas reales leyó las 3 líneas sin errores; el modelo genérico `eng`
  confunde las series de `<` con letras (ver `docs/verificacion-identidad.md`).
