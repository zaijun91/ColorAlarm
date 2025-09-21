document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素获取
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const selectPointsBtn = document.getElementById('select-points-btn');
    const clearPointsBtn = document.getElementById('clear-points-btn');
    const toggleMonitoringBtn = document.getElementById('toggle-monitoring-btn');
    const thresholdInput = document.getElementById('threshold');
    const logBox = document.getElementById('log-box');
    const alarmSound = document.getElementById('alarm-sound');
    const ctx = canvas.getContext('2d');

    let stream;
    let monitoringInterval;
    let isSelectingPoints = false;
    let monitoringPoints = [];
    let isMonitoring = false;

    // --- 日志函数 ---
    function log(message, level = 'INFO') {
        const now = new Date().toLocaleTimeString();
        const p = document.createElement('p');
        
        const colorMap = {
            'INFO': 'black',
            'SUCCESS': 'green',
            'WARNING': 'orange',
            'ALARM': 'red'
        };
        p.style.color = colorMap[level];
        p.innerHTML = `<strong>[${now}] [${level}]</strong> ${message}`;
        
        logBox.appendChild(p);
        logBox.scrollTop = logBox.scrollHeight;
    }

    // --- 摄像头初始化 ---
    async function initCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    facingMode: 'user' 
                } 
            });
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                log('摄像头初始化成功。', 'SUCCESS');
                // 启用设置按钮
                selectPointsBtn.disabled = false;
            };
        } catch (err) {
            log(`摄像头访问失败: ${err.message}`, 'ALARM');
            console.error("getUserMedia error:", err);
            alert('无法访问摄像头。请检查权限设置，并确保您使用的是https或localhost环境。');
        }
    }

    // --- 绘图与交互 ---
    function drawPoints() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        monitoringPoints.forEach((p, i) => {
            ctx.strokeStyle = p.isAlarm ? 'red' : 'lime';
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x - 5, p.y - 5, 10, 10);
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(i + 1, p.x + 7, p.y - 7);
        });
    }

    function handleCanvasClick(event) {
        if (!isSelectingPoints) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // 从视频帧获取颜色
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        
        const newPoint = {
            x: Math.round(x),
            y: Math.round(y),
            r: pixel[0],
            g: pixel[1],
            b: pixel[2],
            isAlarm: false
        };
        monitoringPoints.push(newPoint);
        log(`添加监控点 #${monitoringPoints.length} at (${newPoint.x}, ${newPoint.y}) with color (${newPoint.r}, ${newPoint.g}, ${newPoint.b})`, 'INFO');
        drawPoints();
    }

    // --- 按钮事件绑定 ---
    selectPointsBtn.addEventListener('click', () => {
        isSelectingPoints = !isSelectingPoints;
        if (isSelectingPoints) {
            selectPointsBtn.textContent = '完成选择';
            selectPointsBtn.style.backgroundColor = '#28a745';
            log('进入监控点选择模式。请在视频上单击添加。', 'INFO');
            canvas.style.cursor = 'crosshair';
            // 禁用其他按钮
            clearPointsBtn.disabled = true;
            toggleMonitoringBtn.disabled = true;
        } else {
            selectPointsBtn.textContent = '设置监控点';
            selectPointsBtn.style.backgroundColor = '#007bff';
            log(`完成选择，共设置 ${monitoringPoints.length} 个点。`, 'SUCCESS');
            canvas.style.cursor = 'default';
            // 根据是否有监控点，启用其他按钮
            if (monitoringPoints.length > 0) {
                clearPointsBtn.disabled = false;
                toggleMonitoringBtn.disabled = false;
            }
        }
    });

    // --- 核心监控逻辑 ---
    function rgbToLab(r, g, b) {
        // RGB to XYZ
        [r, g, b] = [r, g, b].map(v => {
            v /= 255;
            return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
        });
        let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
        let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
        let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;

        // XYZ to Lab
        [x, y, z] = [x / 95.047, y / 100, z / 108.883].map(v => {
            return v > 0.008856 ? Math.pow(v, 1 / 3) : (7.787 * v) + (16 / 116);
        });
        const l = (116 * y) - 16;
        const a = 500 * (x - y);
        const b_lab = 200 * (y - z);
        return [l, a, b_lab];
    }

    function deltaE(lab1, lab2) {
        const [l1, a1, b1] = lab1;
        const [l2, a2, b2] = lab2;
        const deltaL = l1 - l2;
        const deltaA = a1 - a2;
        const deltaB = b1 - b2;
        return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
    }

    function checkPoints() {
        if (monitoringPoints.length === 0) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        let overallAlarm = false;

        monitoringPoints.forEach((p, i) => {
            const pixel = ctx.getImageData(p.x, p.y, 1, 1).data;
            const currentLab = rgbToLab(pixel[0], pixel[1], pixel[2]);
            const originalLab = rgbToLab(p.r, p.g, p.b);
            const diff = deltaE(currentLab, originalLab);

            if (diff > parseFloat(thresholdInput.value)) {
                if (!p.isAlarm) {
                    p.isAlarm = true;
                    overallAlarm = true;
                    log(`监控点 #${i + 1} 触发报警! 颜色差值: ${diff.toFixed(2)}`, 'ALARM');
                }
            } else {
                if (p.isAlarm) {
                    p.isAlarm = false;
                    log(`监控点 #${i + 1} 恢复正常。差值: ${diff.toFixed(2)}`, 'SUCCESS');
                }
            }
        });

        drawPoints();

        if (overallAlarm) {
            alarmSound.play().catch(e => console.error("报警音播放失败:", e));
        }
    }

    // --- 按钮事件绑定 ---
    clearPointsBtn.addEventListener('click', () => {
        monitoringPoints = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        log('所有监控点已清除。', 'WARNING');
        clearPointsBtn.disabled = true;
        toggleMonitoringBtn.disabled = true;
    });

    toggleMonitoringBtn.addEventListener('click', () => {
        isMonitoring = !isMonitoring;
        if (isMonitoring) {
            if (monitoringPoints.length === 0) {
                alert('请先设置监控点！');
                isMonitoring = false;
                return;
            }
            toggleMonitoringBtn.textContent = '停止监控';
            toggleMonitoringBtn.style.backgroundColor = '#dc3545';
            monitoringInterval = setInterval(checkPoints, 500); // 每500ms检查一次
            log('监控已开始。', 'SUCCESS');
            selectPointsBtn.disabled = true;
            clearPointsBtn.disabled = true;
        } else {
            toggleMonitoringBtn.textContent = '开始监控';
            toggleMonitoringBtn.style.backgroundColor = '#007bff';
            clearInterval(monitoringInterval);
            log('监控已停止。', 'WARNING');
            selectPointsBtn.disabled = false;
            clearPointsBtn.disabled = false;
            // 将所有点的报警状态重置
            monitoringPoints.forEach(p => p.isAlarm = false);
            drawPoints();
        }
    });
    
    canvas.addEventListener('click', handleCanvasClick);

    // --- 页面加载后执行 ---
    selectPointsBtn.disabled = true;
    clearPointsBtn.disabled = true;
    toggleMonitoringBtn.disabled = true;
    
    initCamera();
});
