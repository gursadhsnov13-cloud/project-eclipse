const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

let scene;
let isPlayerInCar = false;

// Obyektlər
let playerMesh, gunMesh;
let carMesh = null;
let playerCamera, carCamera;

// Zərrəcik Sistemləri (Tüstü)
let smokeSystem = null;

// İdarəetmə klavişləri
const inputMap = {};

const createScene = async function () {
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.03, 1);

    // 1. Fizika Mühərriki (Havok)
    const havokInstance = await HavokPhysics();
    const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), havokPlugin);

    // 2. İşıqlandırma & Neon Atmosfer
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-0.5, -1, -0.5), scene);
    dirLight.position = new BABYLON.Vector3(50, 100, 50);
    dirLight.intensity = 0.8;

    const cyanLight = new BABYLON.PointLight("cyanLight", new BABYLON.Vector3(-20, 15, 20), scene);
    cyanLight.diffuse = new BABYLON.Color3(0, 0.9, 1);
    cyanLight.intensity = 3;

    const magentaLight = new BABYLON.PointLight("magentaLight", new BABYLON.Vector3(20, 15, -20), scene);
    magentaLight.diffuse = new BABYLON.Color3(1, 0, 0.6);
    magentaLight.intensity = 3;

    // 3. Yaş Asfalt Küçə
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 500, height: 500 }, scene);
    const groundMat = new BABYLON.PBRMaterial("groundMat", scene);
    groundMat.albedoColor = new BABYLON.Color3(0.04, 0.04, 0.06);
    groundMat.roughness = 0.08;
    groundMat.metallic = 0.3;
    ground.material = groundMat;
    new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, scene);

    // 4. Kiber-Şəhər Və Yağış
    createCyberCity(scene);
    createRainEffect(scene);

    // 5. Personaj Və FPS Kamera
    playerMesh = BABYLON.MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.4 }, scene);
    playerMesh.position = new BABYLON.Vector3(0, 1, 0);
    playerMesh.visibility = 0;

    playerCamera = new BABYLON.FreeCamera("playerCam", new BABYLON.Vector3(0, 0.8, 0), scene);
    playerCamera.parent = playerMesh;
    playerCamera.attachControl(canvas, true);

    // Silah Modeli (Piyada Rejimi üçün)
    gunMesh = BABYLON.MeshBuilder.CreateBox("gun", { width: 0.1, height: 0.15, depth: 0.6 }, scene);
    gunMesh.parent = playerCamera;
    gunMesh.position = new BABYLON.Vector3(0.3, -0.25, 0.6);
    const gunMat = new BABYLON.StandardMaterial("gunMat", scene);
    gunMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    gunMesh.material = gunMat;

    // 6. 3D Avtomobil Və Drift Tüstüsü
    carMesh = BABYLON.MeshBuilder.CreateBox("carRoot", { width: 2, height: 1, depth: 4 }, scene);
    carMesh.position = new BABYLON.Vector3(5, 0.5, 10);
    carMesh.visibility = 0;

    BABYLON.SceneLoader.ImportMeshAsync("", "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/ToyCar/glTF-Binary/", "ToyCar.glb", scene).then((result) => {
        const importedCar = result.meshes[0];
        importedCar.parent = carMesh;
        importedCar.scaling = new BABYLON.Vector3(20, 20, 20);
        importedCar.position = new BABYLON.Vector3(0, -0.5, 0);
        importedCar.rotation = new BABYLON.Vector3(0, Math.PI, 0);
    });

    smokeSystem = createSmokeEffect(scene, carMesh);

    carCamera = new BABYLON.FollowCamera("carCam", new BABYLON.Vector3(0, 3, -8), scene);
    carCamera.lockedTarget = carMesh;
    carCamera.radius = 8;
    carCamera.heightOffset = 2;

    // 7. Klaviaturanı Və Siçanı Dinləmək
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

    // Atəş Etmək (Sol Düymə)
    window.addEventListener("pointerdown", (evt) => {
        if (evt.button === 0 && !isPlayerInCar) {
            shootGun(scene, playerCamera);
        }
    });

    // 8. Kadra Dair Hərəkət Tənzimləməsi
    scene.onBeforeRenderObservable.add(() => {
        if (isPlayerInCar && carMesh) {
            const speed = 32;
            const turnSpeed = 0.04;
            let isMoving = false;
            let isTurning = false;

            if (inputMap["w"]) {
                carMesh.translate(BABYLON.Axis.Z, speed * engine.getDeltaTime() / 1000, BABYLON.Space.LOCAL);
                isMoving = true;
            }
            if (inputMap["s"]) {
                carMesh.translate(BABYLON.Axis.Z, -speed * 0.5 * engine.getDeltaTime() / 1000, BABYLON.Space.LOCAL);
                isMoving = true;
            }
            if (inputMap["a"]) {
                carMesh.rotation.y -= turnSpeed;
                isTurning = true;
            }
            if (inputMap["d"]) {
                carMesh.rotation.y += turnSpeed;
                isTurning = true;
            }

            if (isMoving && isTurning) {
                smokeSystem.start();
            } else {
                smokeSystem.stop();
            }
        } else if (smokeSystem) {
            smokeSystem.stop();
        }
    });

    return scene;
};

// Atəş Mexanikası (Lazer Güllə Effekti)
function shootGun(scene, camera) {
    const bullet = BABYLON.MeshBuilder.CreateSphere("bullet", { diameter: 0.15 }, scene);
    const bulletMat = new BABYLON.StandardMaterial("bMat", scene);
    bulletMat.emissiveColor = new BABYLON.Color3(0, 1, 1);
    bullet.material = bulletMat;

    bullet.position = camera.globalPosition.clone();
    const ray = camera.getForwardRay();
    const force = ray.direction.scale(100);

    scene.registerBeforeRender(function () {
        bullet.position.addInPlace(force.scale(0.02));
    });

    setTimeout(() => {
        bullet.dispose();
    }, 1000);
}

// Yağış Sistemi
function createRainEffect(scene) {
    const rainParticle = new BABYLON.ParticleSystem("rain", 1500, scene);
    rainParticle.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
    rainParticle.emitter = new BABYLON.Vector3(0, 40, 0);
    rainParticle.minEmitBox = new BABYLON.Vector3(-100, 0, -100);
    rainParticle.maxEmitBox = new BABYLON.Vector3(100, 0, 100);
    rainParticle.color1 = new BABYLON.Color4(0.6, 0.8, 1.0, 0.6);
    rainParticle.color2 = new BABYLON.Color4(0.8, 0.9, 1.0, 0.8);
    rainParticle.colorDead = new BABYLON.Color4(0, 0, 0.2, 0.0);
    rainParticle.minSize = 0.1;
    rainParticle.maxSize = 0.2;
    rainParticle.minScaleY = 5.0;
    rainParticle.maxScaleY = 10.0;
    rainParticle.minLifeTime = 1.0;
    rainParticle.maxLifeTime = 1.5;
    rainParticle.emitRate = 1000;
    rainParticle.gravity = new BABYLON.Vector3(0, -40, 0);
    rainParticle.start();
}

// Drift Tüstüsü
function createSmokeEffect(scene, parentMesh) {
    const smokeSystem = new BABYLON.ParticleSystem("smoke", 500, scene);
    smokeSystem.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
    smokeSystem.emitter = parentMesh;
    smokeSystem.minEmitBox = new BABYLON.Vector3(-0.8, -0.4, -1.8);
    smokeSystem.maxEmitBox = new BABYLON.Vector3(0.8, -0.4, -1.8);
    smokeSystem.color1 = new BABYLON.Color4(0.8, 0.8, 0.8, 0.4);
    smokeSystem.color2 = new BABYLON.Color4(0.6, 0.6, 0.6, 0.2);
    smokeSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    smokeSystem.minSize = 0.5;
    smokeSystem.maxSize = 1.8;
    smokeSystem.minLifeTime = 0.3;
    smokeSystem.maxLifeTime = 0.8;
    smokeSystem.emitRate = 200;
    smokeSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    smokeSystem.gravity = new BABYLON.Vector3(0, 1, 0);
    return smokeSystem;
}

// Kiber-Şəhər
function createCyberCity(scene) {
    const buildingMat = new BABYLON.PBRMaterial("bldgMat", scene);
    buildingMat.albedoColor = new BABYLON.Color3(0.02, 0.02, 0.04);
    buildingMat.metallic = 0.8;
    buildingMat.roughness = 0.2;

    const neonMat = new BABYLON.StandardMaterial("neonMat", scene);
    neonMat.emissiveColor = new BABYLON.Color3(0, 0.9, 1);

    for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
            if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;

            const height = 30 + Math.random() * 50;
            const bldg = BABYLON.MeshBuilder.CreateBox(`bldg_${i}_${j}`, { width: 15, depth: 15, height: height }, scene);
            bldg.position = new BABYLON.Vector3(i * 35, height / 2, j * 35);
            bldg.material = buildingMat;

            const neonStrip = BABYLON.MeshBuilder.CreateBox("neon", { width: 15.2, depth: 15.2, height: 1 }, scene);
            neonStrip.position = new BABYLON.Vector3(i * 35, Math.random() * height, j * 35);
            neonStrip.material = neonMat;
        }
    }
}

// Maşına Minmə / Düşmə
function toggleVehicleEnterExit() {
    const distance = BABYLON.Vector3.Distance(playerMesh.position, carMesh.position);

    if (!isPlayerInCar) {
        if (distance < 5.0) {
            isPlayerInCar = true;
            gunMesh.setEnabled(false);
            document.getElementById("crosshair").style.display = "none";
            scene.activeCamera = carCamera;
            document.getElementById("mode-indicator").innerText = "Rejim: Kiber-Avtomobil (WASD ilə sürün / Drift edin)";
            document.getElementById("mode-indicator").style.color = "#ff0055";
        }
    } else {
        isPlayerInCar = false;
        playerMesh.position = carMesh.position.add(new BABYLON.Vector3(-3, 1, 0));
        gunMesh.setEnabled(true);
        document.getElementById("crosshair").style.display = "block";
        scene.activeCamera = playerCamera;
        document.getElementById("mode-indicator").innerText = "Rejim: Piyada (FPS / Silah Aktivdir)";
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
