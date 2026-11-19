export default {
  id: 'api-029',
  category: 'restassured',
  kind: 'code',
  language: 'java',
  title: 'Multipart upload: the profile avatar (201, 413, 415)',
  level: 'ADVANCED',
  tags: ['multipart', 'file-upload', 'negative-testing', 'content-type'],
  estMinutes: 35,
  scenario: `Sprint 22 adds profile pictures to the ShopEasy app. The story's acceptance criteria: PNG or JPEG only, at most
100 KB, an optional alt text for screen readers, and only the owner can change their picture. A teammate tried to test
it by sending the image as Base64 inside a JSON body ("that's how we send everything else") and got 415 back on every
call. The endpoint is a classic **multipart/form-data** upload — the same thing a browser sends from an
\`<input type="file">\` — and you are asked to cover it.`,
  description: `Endpoint: \`POST /api/users/{id}/avatar\` (auth, own user only), \`multipart/form-data\` with a file part named
**\`file\`** (\`image/png\` or \`image/jpeg\`, 1 byte–100 KB) and an optional text part **\`altText\`**. It answers
\`201 { userId, fileName, contentType, sizeBytes, altText, uploadedAt, url }\` with a \`Location\` header; \`GET\` on the same
path returns the metadata. Errors: 413 \`PAYLOAD_TOO_LARGE\`, 415 \`UNSUPPORTED_MEDIA_TYPE\`, 400 \`VALIDATION_FAILED\`.

The test image is \`src/test/resources/avatars/asha.png\` (a small PNG). Reset and the token for \`standard_user\` (id 1)
are prepared in \`@BeforeMethod\`. Write:

1. **uploadsPngAvatar** — \`.multiPart("file", avatar, "image/png")\` and \`.multiPart("altText", "Asha at the office")\` →
   201, \`contentType\` \`"image/png"\`, \`fileName\` \`"asha.png"\`, \`sizeBytes\` equal to the file's length, \`Location\`
   \`"/api/users/1/avatar"\`. Then \`GET /api/users/{id}/avatar\` → 200 with the same \`altText\`.
2. **fileWithoutMimeTypeIsRejected** — \`.multiPart("file", avatar)\` (no MIME type given) → **415**
   \`UNSUPPORTED_MEDIA_TYPE\`. (RestAssured then sends the part as \`application/octet-stream\`.)
3. **tooLargeIsRejected** — a 150 KB byte array sent as \`.multiPart("file", "big.png", bytes, "image/png")\` → **413**
   \`PAYLOAD_TOO_LARGE\`.
4. **jsonBodyIsRejected** — the old Base64-in-JSON approach → **415** \`UNSUPPORTED_MEDIA_TYPE\`.

**Rules**
- Do **not** set \`contentType(ContentType.JSON)\` on the multipart requests — RestAssured sets
  \`multipart/form-data; boundary=...\` itself.`,
  starterCode: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.io.File;
import java.nio.file.Files;
import java.util.Base64;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class AvatarUploadTest {

    private static final String BASE_URI = "http://localhost:5181";
    private final File avatar = new File("src/test/resources/avatars/asha.png");
    private String token;

    @BeforeMethod
    public void setUp() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @Test
    public void uploadsPngAvatar() throws Exception {
        String base64 = Base64.getEncoder().encodeToString(Files.readAllBytes(avatar.toPath()));
        given().baseUri(BASE_URI).auth().oauth2(token)
            .contentType(ContentType.JSON)
            .body(Map.of("file", base64, "altText", "Asha at the office"))
        .when().post("/api/users/1/avatar")
        .then().statusCode(201);   // always 415...
    }

    // TODO: real multipart upload, octet-stream case, too-large case, JSON-is-rejected case
}
`,
  solution: `package com.shopeasy.api.tests;

import io.restassured.http.ContentType;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.io.File;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class AvatarUploadTest {

    private static final String BASE_URI = "http://localhost:5181";
    private static final String AVATAR_PATH = "/api/users/{id}/avatar";
    private final File avatar = new File("src/test/resources/avatars/asha.png");
    private String token;

    @BeforeMethod
    public void setUp() {
        given().baseUri(BASE_URI).when().post("/api/reset").then().statusCode(200);
        token = given().baseUri(BASE_URI).contentType(ContentType.JSON)
            .body(Map.of("username", "standard_user", "password", "secret_sauce"))
            .when().post("/api/auth/login").then().statusCode(200).extract().path("token");
    }

    @Test
    public void uploadsPngAvatar() {
        given()
            .baseUri(BASE_URI)
            .auth().oauth2(token)
            .pathParam("id", 1)
            .multiPart("file", avatar, "image/png")
            .multiPart("altText", "Asha at the office")
        .when()
            .post(AVATAR_PATH)
        .then()
            .statusCode(201)
            .header("Location", equalTo("/api/users/1/avatar"))
            .body("contentType", equalTo("image/png"))
            .body("fileName", equalTo("asha.png"))
            .body("sizeBytes", equalTo((int) avatar.length()));

        given()
            .baseUri(BASE_URI)
            .pathParam("id", 1)
        .when()
            .get(AVATAR_PATH)
        .then()
            .statusCode(200)
            .body("altText", equalTo("Asha at the office"));
    }

    @Test
    public void fileWithoutMimeTypeIsRejected() {
        given()
            .baseUri(BASE_URI)
            .auth().oauth2(token)
            .pathParam("id", 1)
            .multiPart("file", avatar)            // sent as application/octet-stream
        .when()
            .post(AVATAR_PATH)
        .then()
            .statusCode(415)
            .body("error.code", equalTo("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    public void tooLargeIsRejected() {
        byte[] big = new byte[150 * 1024];

        given()
            .baseUri(BASE_URI)
            .auth().oauth2(token)
            .pathParam("id", 1)
            .multiPart("file", "big.png", big, "image/png")
        .when()
            .post(AVATAR_PATH)
        .then()
            .statusCode(413)
            .body("error.code", equalTo("PAYLOAD_TOO_LARGE"));
    }

    @Test
    public void jsonBodyIsRejected() {
        given()
            .baseUri(BASE_URI)
            .auth().oauth2(token)
            .pathParam("id", 1)
            .contentType(ContentType.JSON)
            .body(Map.of("file", "iVBORw0KGgo=", "altText", "base64 attempt"))
        .when()
            .post(AVATAR_PATH)
        .then()
            .statusCode(415)
            .body("error.code", equalTo("UNSUPPORTED_MEDIA_TYPE"));
    }
}
`,
  checks: [
    { label: 'Uploads the file part with an explicit MIME type', pattern: '\\.multiPart\\(\\s*"file"\\s*,\\s*\\w+\\s*,\\s*"image/png"\\s*\\)', hint: '.multiPart("file", avatar, "image/png")' },
    { label: 'Sends the altText text part', pattern: '\\.multiPart\\(\\s*"altText"\\s*,', hint: '.multiPart("altText", "Asha at the office")' },
    { label: 'Checks sizeBytes against the file', pattern: '"sizeBytes"\\s*,\\s*equalTo\\(', hint: '.body("sizeBytes", equalTo((int) avatar.length()))' },
    { label: 'Reads the avatar back with GET', pattern: '\\.get\\(\\s*(AVATAR_PATH|"/api/users/\\{\\w+\\}/avatar")', hint: '.get("/api/users/{id}/avatar") and check altText' },
    { label: 'Wrong type → 415 UNSUPPORTED_MEDIA_TYPE', pattern: 'statusCode\\(\\s*415\\s*\\)[\\s\\S]*?"UNSUPPORTED_MEDIA_TYPE"', hint: '.statusCode(415).body("error.code", equalTo("UNSUPPORTED_MEDIA_TYPE"))' },
    { label: 'Too large → 413 PAYLOAD_TOO_LARGE', pattern: 'statusCode\\(\\s*413\\s*\\)[\\s\\S]*?"PAYLOAD_TOO_LARGE"', hint: '.multiPart("file", "big.png", new byte[150 * 1024], "image/png") → 413' },
    { label: 'No Base64-in-JSON uploads', pattern: 'Base64\\.getEncoder', mustNot: true, hint: 'Files go in a multipart part, not Base64 inside JSON.' },
  ],
  hints: [
    'multiPart(controlName, file, mimeType) — the control name "file" must match what the server expects, like the name of an HTML input.',
    'multiPart("altText", "text") adds a plain text part; several multiPart calls make one request.',
    'multiPart(controlName, fileName, byte[], mimeType) lets you build test files in memory, e.g. new byte[150 * 1024] for a too-big file.',
  ],
  explanation: `A **multipart/form-data** request carries several *parts* in one body, separated by a boundary string. Each part
has its own headers — a name, maybe a file name, and its own \`Content-Type\`:

\`\`\`
Content-Type: multipart/form-data; boundary=abc123
--abc123
Content-Disposition: form-data; name="file"; filename="asha.png"
Content-Type: image/png

<binary bytes>
--abc123
Content-Disposition: form-data; name="altText"

Asha at the office
--abc123--
\`\`\`

\`.multiPart(...)\` builds all of that, including the boundary — which is why you must not set a JSON content type
yourself (RestAssured even refuses to combine \`multiPart\` with \`contentType(JSON)\`).

The three negative tests map one-to-one onto the acceptance criteria:
- **No MIME type given** → RestAssured labels the part \`application/octet-stream\`, the server sees "not an image" → 415.
  This is the most common real-world upload bug in test code, so it is worth one explicit test.
- **150 KB** generated in memory (\`new byte[...]\`) — no need to keep huge files in the repository → 413.
- **JSON instead of multipart** → 415: the server refuses the whole request format, not just the file type.

Checking \`sizeBytes\` against \`avatar.length()\` proves the server received the whole file, not a truncated one, and the
follow-up GET proves the upload was stored.`,
  mistakes: [
    'Setting contentType(ContentType.JSON) on a multipart request — RestAssured throws, or the boundary is lost.',
    'Leaving out the MIME type and getting application/octet-stream — the server rejects a perfectly good PNG.',
    'Using a different control name ("avatar", "image") than the server expects — the server reports the file part as missing.',
    'Committing large binary fixtures for size tests instead of generating byte arrays in the test.',
  ],
  interview: [
    { q: 'How do you upload a file with RestAssured?', a: 'With given().multiPart("controlName", file, "mime/type"), optionally more multiPart calls for text fields, and post(...). RestAssured builds the multipart/form-data body and boundary. For in-memory data use multiPart(name, fileName, byte[] or InputStream, mimeType).' },
    { q: 'Which negative tests would you write for a file upload endpoint?', a: 'Wrong file type (and a file whose extension lies about its content), empty file, file just over the size limit and exactly at it, missing file part, wrong part name, non-multipart request, no auth and uploading for another user — each with the exact status (400/401/403/413/415) and error code.' },
  ],
}
