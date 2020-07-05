
const firebase = require("@firebase/testing");
const fs = require("fs");

/**
 * The emulator will accept any project ID for testing.
 */
const PROJECT_ID = "firestore-emulator-example";


/**
 * Creates a new client FirebaseApp with authentication and returns the Firestore instance.
 */
function getAuthedFirestore(auth) {
  return firebase
    .initializeTestApp({ projectId: PROJECT_ID, auth })
    .firestore();
}

beforeEach(async () => {
  // Clear the database between tests
  await firebase.clearFirestoreData({ projectId: PROJECT_ID });
});

beforeAll(async () => {
  // Load the rules file before the tests begin
  const rules = fs.readFileSync("firestore.rules", "utf8");
  await firebase.loadFirestoreRules({ projectId: PROJECT_ID, rules });
});

afterAll(async () => {
  // Delete all the FirebaseApp instances created during testing
  // Note: this does not affect or clear any data
  await Promise.all(firebase.apps().map((app) => app.delete()));
});

describe("My app", () => {
  test("require users to log in before creating a profile", async () => {
    const db = getAuthedFirestore(null);
    const profile = db.collection("users").doc("alice");
    await firebase.assertFails(profile.set({ birthday: "January 1" }));
    // await expect(profile.set({ birthday: "January 1" }).toDeny()) -- old code syntax
  });


  test("should enforce the createdAt date in user profiles", async () => {
    const db = getAuthedFirestore({ uid: "alice" });
    const profile = db.collection("users").doc("alice");
    await firebase.assertFails(profile.set({ birthday: "January 1" }));
    await firebase.assertSucceeds(
      profile.set({
        birthday: "January 1",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  });

  test("should only let users create their own profile", async () => {
    const db = getAuthedFirestore({ uid: "alice" });
    await firebase.assertSucceeds(
      db.collection("users").doc("alice").set({
        birthday: "January 1",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
    await firebase.assertFails(
      db.collection("users").doc("bob").set({
        birthday: "January 1",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  });

  test("should let anyone read any profile", async () => {
    const db = getAuthedFirestore(null);
    const profile = db.collection("users").doc("alice");
    await firebase.assertSucceeds(profile.get());
  });

  test("should let anyone create a room", async () => {
    const db = getAuthedFirestore({ uid: "alice" });
    const room = db.collection("rooms").doc("firebase");
    await firebase.assertSucceeds(
      room.set({
        owner: "alice",
        topic: "All Things Firebase",
      })
    );
  });

  test("should force people to name themselves as room owner when creating a room", async () => {
    const db = getAuthedFirestore({ uid: "alice" });
    const room = db.collection("rooms").doc("firebase");
    await firebase.assertFails(
      room.set({
        owner: "scott",
        topic: "Firebase Rocks!",
      })
    );
  });

  test("should not let one user steal a room from another user", async () => {
    const alice = getAuthedFirestore({ uid: "alice" });
    const bob = getAuthedFirestore({ uid: "bob" });

    await firebase.assertSucceeds(
      bob.collection("rooms").doc("snow").set({
        owner: "bob",
        topic: "All Things Snowboarding",
      })
    );

    await firebase.assertFails(
      alice.collection("rooms").doc("snow").set({
        owner: "alice",
        topic: "skiing > snowboarding",
      })
    );
  });
});
