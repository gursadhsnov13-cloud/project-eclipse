const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

let scene;
let isPlayerInCar = false;

// Obyektlər
let playerMesh;
let carMesh = null; // 3D GLTF Model bura yüklənəcək
let playerCamera, carCamera;

// İdarəetmə klavişləri
const inputMap = {};

const createScene = async function () {
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.05, 1); // Tünd Gecə Səması

    // 1. Fizika Mühərriki (Havok)
    const havokInstance = await HavokPhysics();
    const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), havokPlugin);

    // 2. Neon & Kinematoqrafik İşıqlandırma
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-0.5, -1, -0.5), scene);
    dirLight.position = new BABYLON.Vector3(50, 100, 50);
    dirLight.intensity = 0.8;

    // Kiber-Neon İşıqları (Mövzuya uyğun göy və bənövşəyi işıqlar)
    const cyanLight = new BABYLON.PointLight("cyanLight", new BABYLON.Vector3(-20, 15, 20), scene);
    cyanLight.diffuse = new BABYLON.Color3(0, 0.9, 1);
    cyanLight.intensity = 3;

    const magentaLight = new BABYLON.PointLight("magentaLight", new BABYLON.Vector3(20, 15, -20), scene);
    magentaLight.diffuse = new BABYLON.Color3(1, 0, 0.6);
    magentaLight.intensity = 3;

    // 3. Yaş Asfalt Küçə
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 500, height: 500 }, scene);
    const groundMat = new BABYLON.PBRMaterial("groundMat", scene);
    groundMat.albedoColor = new BABYLON.Color3(0.05, 0.05, 0.08);
    groundMat.roughness = 0.1; // İşıqları əks etdirən yaş asfalt
    groundMat.metallic = 0.2;
    ground.material = groundMat;
    new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, scene);

    // 4. Kiber-Şəhər Binaları Və Neon Lövhələr
    createCyberCity(scene);

    // 5. Personaj (Piyada Rejimi)
    playerMesh = BABYLON.MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.4 }, scene);
    playerMesh.position = new BABYLON.Vector3(0, 1, 0);
    const playerMat = new BABYLON.StandardMaterial("playerMat", scene);
    playerMat.diffuseColor = new BABYLON.Color3(0, 0.8, 1);
    playerMesh.material = playerMat;

    playerCamera = new BABYLON.FreeCamera("playerCam", new BABYLON.Vector3(0, 0.8, 0), scene);
    playerCamera.parent = playerMesh;
    playerCamera.attachControl(canvas, true);

    // 6. 3D Realistik Maşın Modelinin Yüklənməsi (.GLTF / .GLB)
    carMesh = BABYLON.MeshBuilder.CreateBox("carRoot", { width: 2, height: 1, depth: 4 }, scene);
    carMesh.position = new BABYLON.Vector3(5, 0.5, 10);
    carMesh.visibility = 0; // Kök qutunu gizlədirik, sadəcə fizika və kamera üçün istifadə olunur

    // Pulsuz 3D Avtomobil Modelinin Çəkilməsi
    BABYLON.SceneLoader.ImportMeshAsync("", "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/ToyCar/glTF-Binary/", "ToyCar.glb", scene).then((result) => {
        const importedCar = result.meshes[0];
        importedCar.parent = carMesh;
        importedCar.scaling = new BABYLON.Vector3(20, 20, 20); // Modelin ölçüsünü uyğunlaşdırırıq
        importedCar.position = new BABYLON.Vector3(0, -0.5, 0);
        importedCar.rotation = new BABYLON.Vector3(0, Math.PI, 0);
    });

    carCamera = new BABYLON.FollowCamera("carCam", new BABYLON.Vector3(0, 3, -8), scene);
    carCamera.lockedTarget = carMesh;
    carCamera.radius = 8;
    carCamera.heightOffset = 2;

    // 7. Klaviaturanı Dinləmək
    scene.actionManager = new BABYLON.ActionManager(scene);
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, (evt) => {
        inputMap[evt.sourceEvent.key.toLowerCase()] = true;
        if (evt.sourceEvent.key.toLowerCase() === "e") {
            toggleVehicleEnterExit();
        }
    }));
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
        inputMap[evt.sourceEvent.key.toLowerCase()] = false;
    }));

    // 8. Kadra Dair Hərəkət Yenilənməsi
    scene.onBeforeRenderObservable.add(() => {
        if (isPlayerInCar && carMesh) {
            const speed = 30;
            const turnSpeed = 0.035;

            if (inputMap["w"]) {
                carMesh.translate(BABYLON.Axis.Z, speed * engine.getDeltaTime() / 1000, BABYLON.Space.LOCAL);
            }
            if (inputMap["s"]) {
                carMesh.translate(BABYLON.Axis.Z, -speed * 0.5 * engine.getDeltaTime() / 1000, BABYLON.Space.LOCAL);
            }
            if (inputMap["a"]) {
                carMesh.rotation.y -= turnSpeed;
            }
            if (inputMap["d"]) {
                carMesh.rotation.y += turnSpeed;
            }
        }
    });

    return scene;
};

// Kiber-Şəhər Göydələnlərini Quran Funksiya
function createCyberCity(scene) {
    const buildingMat = new BABYLON.PBRMaterial("bldgMat", scene);
    buildingMat.albedoColor = new BABYLON.Color3(0.02, 0.02, 0.04);
    buildingMat.metallic = 0.8;
    buildingMat.roughness = 0.2;

    const neonMat = new BABYLON.StandardMaterial("neonMat", scene);
    neonMat.emissiveColor = new BABYLON.Color3(0, 0.9, 1); // Özündən işıq saçan neon material

    for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
            if (Math.abs(i) < 2 && Math.abs(j) < 2) continue; // Mərkəzi boş saxlayırıq (sürüş zonası)

            const height = 30 + Math.random() * 50;
            const bldg = BABYLON.MeshBuilder.CreateBox(`bldg_${i}_${j}`, { width: 15, depth: 15, height: height }, scene);
            bldg.position = new BABYLON.Vector3(i * 35, height / 2, j * 35);
            bldg.material = buildingMat;

            // Binaların üzərinə neon xətlər əlavə edirik
            const neonStrip = BABYLON.MeshBuilder.CreateBox("neon", { width: 15.2, depth: 15.2, height: 1 }, scene);
            neonStrip.position = new BABYLON.Vector3(i * 35, Math.random() * height, j * 35);
            neonStrip.material = neonMat;
        }
    }
}

// Maşına Minmə / Düşmə Mexanikası
function toggleVehicleEnterExit() {
    const distance = BABYLON.Vector3.Distance(playerMesh.position, carMesh.position);

    if (!isPlayerInCar) {
        if (distance < 5.0) {
            isPlayerInCar = true;
            playerMesh.setEnabled(false);
            scene.activeCamera = carCamera;
            document.getElementById("mode-indicator").innerText = "Rejim: Kiber-Avtomobil (WASD ilə sürün)";
            document.getElementById("mode-indicator").style.color = "#ff0055";
        }
    } else {
        isPlayerInCar = false;
        playerMesh.position = carMesh.position.add(new BABYLON.Vector3(-3, 1, 0));
        playerMesh.setEnabled(true);
        scene.activeCamera = playerCamera;
        document.getElementById("mode-indicator").innerText = "Rejim: Piyada (FPS Kəşfiyyat)";
        document.getElementById("mode-indicator").style.color = "#00f3ff";
    }
}

createScene().then((sc) => {
    engine.runRenderLoop(() => {
        sc.render();
    });
});

window.addEventListener("resize", () => {
    engine.resize();
});
