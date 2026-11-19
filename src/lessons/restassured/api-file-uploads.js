export default {
  slug: 'api-file-uploads',
  category: 'restassured',
  order: 9,
  title: 'Uploading files: multipart/form-data with RestAssured',
  minutes: 7,
  summary: 'Send a file and text fields in one multipart request with multiPart(...), and design the negative tests every upload endpoint needs (wrong type, too large, wrong format).',
  manualAnalogy: `When you test "upload a profile picture" by hand, you pick a file in the browser's file dialog, maybe type a caption, and press Save. Then you try the nasty ones: a PDF renamed to .png, a 20 MB photo, an empty file. In Postman that is the Body tab set to **form-data**, with one row of type *File* and one of type *Text*. RestAssured's \`multiPart(...)\` is exactly that form-data tab.`,
  body: `## What a multipart request looks like

Everything you have sent so far was one JSON document. A file upload is different: the body holds several **parts**, each with its own little header, separated by a random boundary string:

\`\`\`
POST /api/users/3/avatar
Content-Type: multipart/form-data; boundary=x7Gk2

--x7Gk2
Content-Disposition: form-data; name="file"; filename="vera.jpg"
Content-Type: image/jpeg

<the bytes of the picture>
--x7Gk2
Content-Disposition: form-data; name="altText"

Vera in San Francisco
--x7Gk2--
\`\`\`

- \`name="file"\` is the **control name** — like the \`name\` of an HTML \`<input>\`. The server looks for exactly that name.
- The file part has its own \`Content-Type\` (\`image/jpeg\`), separate from the request's \`multipart/form-data\`.
- Text fields are parts too, just without a file name.

## Sending it with RestAssured

\`\`\`java
File photo = new File("src/test/resources/avatars/vera.jpg");

given()
    .auth().oauth2(veraToken)
    .multiPart("file", photo, "image/jpeg")          // control name, file, MIME type
    .multiPart("altText", "Vera in San Francisco")   // a text part
.when()
    .post("/api/users/{id}/avatar", 3)
.then()
    .statusCode(201)
    .body("contentType", equalTo("image/jpeg"));
\`\`\`

Line by line:
- Each \`multiPart(...)\` call adds one part; RestAssured builds the boundary and sets \`Content-Type: multipart/form-data\` for you.
- **Do not** add \`contentType(ContentType.JSON)\` — RestAssured refuses to combine it with multipart, and the server would not understand it anyway.
- Always pass the **MIME type** for files. Without it RestAssured labels the part \`application/octet-stream\`, and a server that only accepts images rejects a perfectly good photo with **415 Unsupported Media Type**.
- Test files live under \`src/test/resources\` and stay small. For "too large" cases, build the bytes in memory instead of committing a huge file:

\`\`\`java
byte[] tooBig = new byte[300 * 1024];
given().auth().oauth2(veraToken)
    .multiPart("file", "huge.jpg", tooBig, "image/jpeg")   // name, file name, bytes, MIME type
.when().post("/api/users/{id}/avatar", 3)
.then().statusCode(413);
\`\`\`

## The ShopEasy avatar endpoint

The practice API has \`POST /api/users/{id}/avatar\` (own user only) with a file part \`file\` (PNG or JPEG, up to 100 KB) and an optional text part \`altText\`. \`GET\` on the same path returns the stored metadata (\`fileName\`, \`contentType\`, \`sizeBytes\`, \`altText\`), and \`DELETE\` removes it.

## Negative tests for any upload

| Case | ShopEasy answer |
|---|---|
| file type not allowed (or no MIME type given) | 415 \`UNSUPPORTED_MEDIA_TYPE\` |
| request is JSON, not multipart | 415 \`UNSUPPORTED_MEDIA_TYPE\` |
| file over the limit | 413 \`PAYLOAD_TOO_LARGE\` |
| no part called \`file\`, or an empty file | 400 \`VALIDATION_FAILED\`, \`details.field\` = \`file\` |
| no token / someone else's profile | 401 / 403 |

Add a boundary pair for the size (exactly 100 KB passes, one byte more fails) and, on real systems, a file whose extension lies about its content (a text file called \`photo.png\`).

## Checking that the upload really arrived

A 201 alone does not prove the server stored the whole file. Compare \`sizeBytes\` in the response with \`file.length()\` on your side, and read the resource back with a GET — the same "create, then read back" habit as for orders.`,
  keyPoints: [
    'multipart/form-data carries several parts in one request; each part has a name and its own Content-Type.',
    'multiPart("file", file, "image/png") adds a file part; multiPart("altText", "text") adds a text field.',
    'Never set a JSON content type on a multipart request; always give the file part a MIME type.',
    'Upload negatives: wrong type (415), too large (413), missing/empty file (400), auth (401/403).',
    'Prove the upload with sizeBytes and a follow-up GET, not just the 201.',
  ],
  mistakes: [
    'Sending the file as Base64 inside JSON to an endpoint that expects multipart — every call fails with 415.',
    'Forgetting the MIME type, so the file goes out as application/octet-stream and is rejected.',
    'Using a different control name than the server expects ("image" instead of "file").',
    'Keeping large binary fixtures in the repository for size tests — generate byte arrays in the test.',
  ],
  tryIt: `With \`npm run api\` running, log in as standard_user in Postman, then POST to http://localhost:5181/api/users/1/avatar with Body → form-data: a row \`file\` of type File (any small PNG) and a row \`altText\` of type Text. Then open http://localhost:5181/api/users/1/avatar in the browser. Repeat with a PDF and note the status and error code.`,
  problems: ['api-029'],
}
