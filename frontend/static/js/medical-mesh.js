// medical-mesh.js — Dazzling AI Diagnostics Background (DENSE & FEATURE-RICH & AUTHENTIC HUD)
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('medical-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height;
    let particles = [];
    let diagnosticsTexts = [];
    
    // Mouse tracking for interactive "Ultrasound Probe" effect
    let mouse = { x: -1000, y: -1000 };
    let mouseRipples = [];

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        
        // Randomly drop a diagnostic text near mouse occasionally
        if (Math.random() < 0.015) {
            spawnDiagnosticText(mouse.x + (Math.random()*150 - 75), mouse.y + (Math.random()*150 - 75));
        }
    });

    window.addEventListener('mouseleave', () => {
        mouse.x = -1000;
        mouse.y = -1000;
    });

    window.addEventListener('click', (e) => {
        // Create an ultrasound radar ping on click
        mouseRipples.push({ x: e.clientX, y: e.clientY, radius: 0, alpha: 1 });
        spawnDiagnosticText(e.clientX + 30, e.clientY - 20, "PROBE INITIATED");
    });

    const medicalKeywords = [
        "SCANNING TISSUE DENSITY...", "ANALYZING PATTERN...", "DETECTING ANOMALIES...", 
        "AI CONFIDENCE: 98.4%", "MATCHING REFERENCE DB...", "SEGMENTATION COMPLETE",
        "PULMONARY CHECK: CLEAR", "PROCESSING LAYER 4...", "MEASURING VOLUME...",
        "CALCULATING RATIOS...", "ISOLATING REGION...", "DIAGNOSTIC TRACE"
    ];

    function spawnDiagnosticText(x, y, overrideText = null) {
        if (diagnosticsTexts.length > 20) return; // Keep it clean, don't overwhelm
        const text = overrideText || medicalKeywords[Math.floor(Math.random() * medicalKeywords.length)];
        diagnosticsTexts.push({
            x: x, y: y, text: text, textAlpha: 0.9, life: 120
        });
    }

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        initParticles();
    }
    
    window.addEventListener('resize', resize);

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            // Slightly faster drift for more life
            this.vx = (Math.random() - 0.5) * 0.6;
            this.vy = (Math.random() - 0.5) * 0.6;
            this.baseRadius = Math.random() * 2 + 1.5;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            
            // Bounce off edges smoothly
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;
            
            // Magnetic repel from mouse center
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                this.x += dx * 0.015;
                this.y += dy * 0.015;
            }
        }

        draw(scanY, scanX) {
            const distToScanY = Math.abs(this.y - scanY);
            const distToScanX = Math.abs(this.x - scanX);
            
            let scanIntensity = 0;
            // Crosshair effect (responds to either horizontal or vertical scan)
            if (distToScanY < 250) scanIntensity = Math.max(scanIntensity, Math.pow(1 - (distToScanY / 250), 2));
            if (distToScanX < 250) scanIntensity = Math.max(scanIntensity, Math.pow(1 - (distToScanX / 250), 2));
            
            const distToMouse = Math.sqrt(Math.pow(this.x - mouse.x, 2) + Math.pow(this.y - mouse.y, 2));
            let probeIntensity = 0;
            if (distToMouse < 250) {
                probeIntensity = 1 - (distToMouse / 250);
            }

            const totalIntensity = Math.min(1, scanIntensity + probeIntensity);

            // Deep sky blue (#0284c7) for high contrast
            const alpha = 0.25 + (totalIntensity * 0.8);
            const radius = this.baseRadius + (totalIntensity * 2);

            ctx.beginPath();
            ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(2, 132, 199, ${alpha})`;
            ctx.fill();
            
            // Solid bright core when highly scanned
            if (totalIntensity > 0.4) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, radius * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(3, 105, 161, ${totalIntensity})`; 
                ctx.fill();
            }
        }
    }

    function initParticles() {
        particles = [];
        // Dense network
        const numParticles = Math.min(Math.floor((width * height) / 4500), 400); 
        for (let i = 0; i < numParticles; i++) {
            particles.push(new Particle());
            // Randomly spawn background diagnostic text on some regions
            if (Math.random() < 0.05) spawnDiagnosticText(particles[i].x, particles[i].y);
        }
    }

    resize();

    // Dual Scanner Beam State
    let scanY = -300;
    let scanX = -300;
    const scanSpeedY = 3.5;
    const scanSpeedX = 2.0; 

    // EKG Heartbeat Trace State
    let ekgX = 0;

    function animate() {
        ctx.clearRect(0, 0, width, height);

        scanY += scanSpeedY;
        if (scanY > height + 400) scanY = -400;
        
        scanX += scanSpeedX;
        if (scanX > width + 400) scanX = -400;

        // --- DRAW AUTHENTIC MEDICAL HUD ---
        drawDICOMHud();
        drawCTRings();
        drawEKGTrace();

        // Draw Horizontal MRI Scanner Beam
        const scanHeight = 400;
        const scanGradientY = ctx.createLinearGradient(0, scanY - (scanHeight/2), 0, scanY + (scanHeight/2));
        scanGradientY.addColorStop(0, 'rgba(2, 132, 199, 0)');
        scanGradientY.addColorStop(0.5, 'rgba(2, 132, 199, 0.12)'); // Deep blue overlay
        scanGradientY.addColorStop(1, 'rgba(2, 132, 199, 0)');
        ctx.fillStyle = scanGradientY;
        ctx.fillRect(0, scanY - (scanHeight/2), width, scanHeight);

        // Core scanning laser line
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(width, scanY);
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Vertical MRI Scanner Beam
        const scanWidth = 400;
        const scanGradientX = ctx.createLinearGradient(scanX - (scanWidth/2), 0, scanX + (scanWidth/2), 0);
        scanGradientX.addColorStop(0, 'rgba(14, 165, 233, 0)');
        scanGradientX.addColorStop(0.5, 'rgba(14, 165, 233, 0.08)');
        scanGradientX.addColorStop(1, 'rgba(14, 165, 233, 0)');
        ctx.fillStyle = scanGradientX;
        ctx.fillRect(scanX - (scanWidth/2), 0, scanWidth, height);

        ctx.beginPath();
        ctx.moveTo(scanX, 0);
        ctx.lineTo(scanX, height);
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw the analytical crosshair reticle where they intersect
        ctx.beginPath();
        ctx.arc(scanX, scanY, 40, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(scanX, scanY, 5, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(2, 132, 199, 0.8)';
        ctx.fill();

        // Draw Ultrasound Mouse Ripples (pulse effect)
        for (let i = mouseRipples.length - 1; i >= 0; i--) {
            const ripple = mouseRipples[i];
            ripple.radius += 4.5;
            ripple.alpha -= 0.015;
            
            ctx.beginPath();
            ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(2, 132, 199, ${ripple.alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            if (ripple.alpha <= 0) mouseRipples.splice(i, 1);
        }

        // Connections & Particles
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 150) {
                    const avgY = (particles[i].y + particles[j].y) / 2;
                    const avgX = (particles[i].x + particles[j].x) / 2;
                    
                    const distToScanY = Math.abs(avgY - scanY);
                    const distToScanX = Math.abs(avgX - scanX);
                    let scanIntensity = 0;
                    if (distToScanY < 250) scanIntensity = Math.max(scanIntensity, Math.pow(1 - (distToScanY / 250), 2));
                    if (distToScanX < 250) scanIntensity = Math.max(scanIntensity, Math.pow(1 - (distToScanX / 250), 2));
                    
                    const distToMouse = Math.sqrt(Math.pow(avgX - mouse.x, 2) + Math.pow(avgY - mouse.y, 2));
                    let probeIntensity = 0;
                    if (distToMouse < 250) probeIntensity = 1 - (distToMouse / 250);

                    const totalIntensity = Math.min(1, scanIntensity + probeIntensity);
                    
                    const baseAlpha = 1 - (dist / 150);
                    const finalAlpha = (baseAlpha * 0.15) + (baseAlpha * totalIntensity * 0.7);
                    
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(2, 132, 199, ${finalAlpha})`;
                    ctx.lineWidth = totalIntensity > 0.4 ? 1.5 : 1;
                    ctx.stroke();
                }
            }
            particles[i].draw(scanY, scanX);
        }

        // Draw floating analytical diagnostic data texts 
        ctx.font = "bold 11px 'Space Grotesk', sans-serif";
        for (let i = diagnosticsTexts.length - 1; i >= 0; i--) {
            const dt = diagnosticsTexts[i];
            dt.life--;
            dt.y -= 0.6; // Drift up slowly
            ctx.fillStyle = `rgba(3, 105, 161, ${(dt.life/120) * dt.textAlpha})`;
            ctx.fillText(dt.text + ` [X:${Math.floor(dt.x)}, Y:${Math.floor(dt.y)}]`, dt.x, dt.y);
            if (dt.life <= 0) diagnosticsTexts.splice(i, 1);
        }

        requestAnimationFrame(animate);
    }

    // --- AUTHENTIC MEDICAL RENDER FUNCTIONS --- //

    function drawDICOMHud() {
        const margin = 30;
        const bracketSize = 40;
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.35)'; // High contrast medical blue
        ctx.fillStyle = 'rgba(2, 132, 199, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        
        // Corner Brackets
        ctx.beginPath(); ctx.moveTo(margin, margin + bracketSize); ctx.lineTo(margin, margin); ctx.lineTo(margin + bracketSize, margin); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(width - margin - bracketSize, margin); ctx.lineTo(width - margin, margin); ctx.lineTo(width - margin, margin + bracketSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(margin, height - margin - bracketSize); ctx.lineTo(margin, height - margin); ctx.lineTo(margin + bracketSize, height - margin); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(width - margin - bracketSize, height - margin); ctx.lineTo(width - margin, height - margin); ctx.lineTo(width - margin, height - margin - bracketSize); ctx.stroke();

        // Edge Ruler Ticks (Left & Right)
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for(let i = margin + 80; i < height - margin - 80; i += 20) {
            let tickLength = (i % 100 < 20) ? 12 : 6;
            ctx.moveTo(margin, i); ctx.lineTo(margin + tickLength, i);
            ctx.moveTo(width - margin, i); ctx.lineTo(width - margin - tickLength, i);
        }
        // Top & Bottom
        for(let i = margin + 80; i < width - margin - 80; i += 20) {
            let tickLength = (i % 100 < 20) ? 12 : 6;
            ctx.moveTo(i, margin); ctx.lineTo(i, margin + tickLength);
            ctx.moveTo(i, height - margin); ctx.lineTo(i, height - margin - tickLength);
        }
        ctx.stroke();

        // Clinical Overlay Data
        ctx.font = "bold 13px 'Space Grotesk', monospace";
        ctx.fillText("DX-VISION v2.4", margin + 15, margin + 25);
        ctx.fillText("FILTER: ENHANCED", margin + 15, margin + 45);
        ctx.fillText("SERIES: AXIAL 3D", margin + 15, margin + 65);

        ctx.textAlign = "right";
        ctx.fillText("WL: 40 WW: 400", width - margin - 15, margin + 25);
        ctx.fillText("TILT: +0.0°", width - margin - 15, margin + 45);
        ctx.fillText("ZOOM: 1.25x", width - margin - 15, margin + 65);
        
        ctx.fillText("R", width - margin - 15, height / 2); // Right anatomical marker
        ctx.textAlign = "left";
        ctx.fillText("L", margin + 15, height / 2); // Left anatomical marker
    }

    function drawCTRings() {
        ctx.save();
        ctx.translate(width/2, height/2);
        
        const now = Date.now();
        // Outer Slow Ring
        ctx.rotate(now * 0.0001);
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(width, height) * 0.38, 0, Math.PI * 2);
        ctx.setLineDash([30, 15, 5, 15]);
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.15)'; 
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner Counter-Rotating Target Ring
        ctx.rotate(-now * 0.00025);
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(width, height) * 0.33, 0, Math.PI * 2);
        ctx.setLineDash([50, 25]);
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        ctx.restore();
    }

    function drawEKGTrace() {
        ekgX += 4;
        if (ekgX > width + 200) ekgX = -200; // Loop EKG
        
        const ekgY = height - 60; // Run along the bottom
        ctx.beginPath();
        ctx.moveTo(0, ekgY);
        
        // Draw standard flat line up to ekgX, then the pulse, then flat line
        for(let i = 0; i < width; i+=2) {
            let y = ekgY;
            // The pulse occurs right at ekgX
            let dist = i - ekgX;
            if (dist > 0 && dist < 60) {
                // Classic P-QRS-T wave shape approximation
                if (dist < 10) y -= 5;         // P wave
                else if (dist < 15) y += 5;    // Q
                else if (dist < 25) y -= 40;   // R spike
                else if (dist < 32) y += 20;   // S dip
                else if (dist > 45 && dist < 55) y -= 8; // T wave
            }
            ctx.lineTo(i, y);
        }
        
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
        
        // Glowing dot at the leading edge
        if (ekgX > 0 && ekgX < width) {
            let currentY = ekgY;
            ctx.beginPath();
            ctx.arc(ekgX + 60, currentY, 4, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(14, 165, 233, 0.8)';
            ctx.fill();
        }
    }

    animate();
});
