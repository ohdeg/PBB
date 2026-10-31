# 6PICK browser OCR assets

Run `npm run prepare:lotto-ocr` before development or release builds on a machine with network access.
This downloads public browser bundles for Tesseract.js **7.0.0**, Tesseract.js-core **7.0.0**,
and eng/kor data **1.0.0** (4.0.0_best_int). It never reads environment files.
Assets are served by this app's origin; receipt images never go to the CDN or server.

Generated assets are ignored. The generated manifest records source URLs and SHA-256 hashes;
subsequent preparation rejects changed files. Initial downloads rely on HTTPS and pinned versions,
not a separately verified upstream checksum. Keep the manifest with your release artifact.
Apache-2.0 license notices are downloaded beside the engine and core. Language data:
https://github.com/naptha/tessdata (Apache-2.0).

Preparation failures must be resolved before enabling OCR in a release. Direct number entry
remains available if the OCR module fails to load. Automated UI tests use an OCR adapter mock;
they do not certify recognition accuracy on real tickets.
