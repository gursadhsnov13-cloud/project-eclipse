const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

let scene;
let isPlayerInCar = false;

// Personaj və Maşın Obyektləri
let playerMesh, carMesh;
let playerCamera, carCamera;

const createScene = async function () {
    scene = new BABYLON.Scene(engine);

    // 1. Havok Fizika Mühərrikinin Başladılması
    const havokInstance = await HavokPhysics();
    const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), havokPlugin);

    // 2. Peşəkar İşıqlandırma & Atmosfer (HDR Environment)
    const envTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/studio.env", 
        scene
    );
    scene.environmentTexture = envTexture;
    scene.createDefaultSkybox(envTexture, true, 1000, 0.3);

    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);
    dirLight.intensity = 1.5;

    // 3. Ərazi (Ground)
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 200, height: 200 }, scene);
    const groundMat = new BABYLON.PBRMaterial("groundMat", scene);
    groundMat.roughness = 0.2; // Yaş asfalt effekti
    groundMat.metallic = 0.1;
    ground.material = groundMat;
    new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, scene);

    // 4. Personaj Yaratmaq (Piyada Rejimi)
    playerMesh = BABYLON.MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.4 }, scene);
    playerMesh.position = new BABYLON.Vector3(0, 1, 0);
    const playerMat = new BABYLON.StandardMaterial("playerMat", scene);
    playerMat.diffuseColor = new BABYLON.Color3(0, 0.8, 1);
    playerMesh.material = playerMat;

    playerCamera = new BABYLON.FreeCamera("playerCam", new BABYLON.Vector3(0, 0.8, 0), scene);
    playerCamera.parent = playerMesh;
    playerCamera.attachControl(canvas, true);

    // 5. Maşın Yaratmaq (Avtomobil Rejimi)
    carMesh = BABYLON.MeshBuilder.CreateBox("car", { width: 2, height: 1, depth: 4 }, scene);
    carMesh.position = new BABYLON.Vector3(5, 0.5, 10);
    const carMat = new BABYLON.PBRMaterial("carMat", scene);
    carMat.albedoColor = new BABYLON.Color3(0.8, 0.05, 0.05);
    carMat.metallic = 0.9;
    carMat.roughness = 0.1; // Parlaq avtomobil boyası
    carMesh.material = carMat;

    carCamera = new BABYLON.FollowCamera("carCam", new BABYLON.Vector3(0, 3, -7), scene);
    carCamera.lockedTarget = carMesh;
    carCamera.radius = 8;
    carCamera.heightOffset = 2;

    // 6. Düymə Tətikləri (Enter/Exit & Movement)
    window.addEventListener("keydown", (evt) => {
        if (evt.key.toLowerCase() === "e") {
            toggleVehicleEnterExit();
        }
    });

    return scene;
};

// Maşına Minmə / Düşmə Mexanikası
function toggleVehicleEnterExit() {
    const distance = BABYLON.Vector3.Distance(playerMesh.position, carMesh.position);

    if (!isPlayerInCar) {
        // Maşına Yaxındırsa Min
        if (distance < 3.5) {
            isPlayerInCar = true;
            playerMesh.setEnabled(false); // Personajı gizlət
            scene.activeCamera = carCamera;
            document.getElementById("mode-indicator").innerText = "Rejim: Avtomobil (Drift/Sürət)";
            document.getElementById("mode-indicator").style.color = "#ff3300";
        }
    } else {
        // Maşından Düş
        isPlayerInCar = false;
        playerMesh.position = carMesh.position.add(new BABYLON.Vector3(-2, 1, 0)); // Maşının yanına qoy
        playerMesh.setEnabled(true); // Personajı göstər
        scene.activeCamera = playerCamera;
        document.getElementById("mode-indicator").innerText = "Rejim: Piyada (FPS)";
        document.getElementById("mode-indicator").style.color = "#00f3ff";
    }
}

// Oyunu Başlatmaq
createScene().then((sc) => {
    engine.runRenderLoop(() => {
        sc.render();
    });
});

window.addEventListener("resize", () => {
    engine.resize();
});
