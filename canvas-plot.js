
var Plot = function() {
    var MILLI_TO_SECONDS = 1 / 1000;

    var initialized = false;
    var tickId = null;
    var lastTickTime = 0;
    var lastFrameTime = 0;

    var deltaSeconds = 0;
    var totalSeconds = 0;
    var frames = 0;

    var canvas = null;
    var context = null;

    var porj = null;
    var view = null;
    var viewProj = null;
    var invView = null;
    var invProj = null;
    var invViewProj = null;

    var widgets = {
        canvas: null,
        title: null,
        play: null,
        progress: null,
        zoomIn: null,
        zoomOut: null,
    };

    var timer = null;
    var playing = false;

    var camX = 0;
    var camY = 0;
    var mouseX = 0;
    var mouseY = 0;
    var mouseZ = 0;
    var lastX = 0;
    var lastY = 0;
    var zoom = 0;
    var zoomSpeed = 0.1;
    var zoomSpeedWheel = 0.2;

    var dragging = false;

    var zoomInHeld = false;
    var zoomOutHeld = false;
    var progressHeld = false;

    this.minZoom = 1;
    this.maxZoom = 3;
    this.bgColor = "#eee";
    this.axisFont = "Arial";
    this.axisFontSize = 10; // in pixels.
    this.axisLineColor = "#767676";
    this.axisLabelColor = "#000";
    this.defaultLineColor = "#000";

    this.start = function () {
        if (!initialized) {
            init ();
            initialized = true;
        }
        tickId = requestTick (tick);
    };

    this.stop = function () {
        cancelTick (tick);
    };

    var init = function () {
        canvas = document.getElementById ("canvas-widget");
        canvas.addEventListener('mouseenter', handleMouseEnter.bind(this));
        canvas.addEventListener('mouseleave', handleMouseLeave.bind(this));
        canvas.addEventListener('mousemove', handleMouseMove.bind(this));
        canvas.addEventListener('mouseup', handleMouseUp.bind(this));
        canvas.addEventListener('mousedown', handleMouseDown.bind(this));
        canvas.addEventListener('wheel', handleMouseWheel.bind(this));

        widgets.title = document.getElementById ('title-widget');
        widgets.title.innerHTML = config.title;

        widgets.play = document.getElementById ('play-widget');
        widgets.play.addEventListener('click', this.toggle.bind(this));

        widgets.progress = document.getElementById ('progress-widget');
        widgets.progress.addEventListener('mouseup', handleProgress.bind(this));
        widgets.progress.addEventListener('mousedown', handleProgress.bind(this));
        widgets.progress.addEventListener('mousemove', handleProgress.bind(this));
        widgets.progress.addEventListener('mouseleave', handleProgress.bind(this));

        widgets.zoomIn = document.getElementById ('zoomin-widget');
        widgets.zoomIn.addEventListener('mouseup', handleZoomIn.bind(this));
        widgets.zoomIn.addEventListener('mousedown', handleZoomIn.bind(this));
        widgets.zoomIn.addEventListener('mouseleave', handleZoomIn.bind(this));

        widgets.zoomOut = document.getElementById ('zoomout-widget');
        widgets.zoomOut.addEventListener('mouseup', handleZoomOut.bind(this));
        widgets.zoomOut.addEventListener('mousedown', handleZoomOut.bind(this));
        widgets.zoomOut.addEventListener('mouseleave', handleZoomOut.bind(this));

        widgets.resetView = document.getElementById ('resetview-widget');
        widgets.resetView.addEventListener('click', handleResetView.bind(this));

        context = canvas.getContext('2d');

        proj = mat2d.create();
        view = mat2d.create();
        viewProj = mat2d.create();
        invView = mat2d.create();
        invProj = mat2d.create();
        invViewProj = mat2d.create();

        mat2d.translate (proj, proj, vec2.fromValues (
            canvas.width / 2,
            canvas.height / 2
        ));

        timer = new Timer (5);

        zoom = this.minZoom;
    }.bind(this);

    var handleMouseEnter = function(event) {
        mouseX = event.clientX - canvas.offsetLeft;
        mouseY = event.clientY - canvas.offsetTop;
        mouseZ = 0;
    };

    var handleMouseLeave = function(event) {
        dragging = false;
    };

    var handleMouseMove = function(event) {
        mouseX = event.clientX - canvas.offsetLeft;
        mouseY = event.clientY - canvas.offsetTop;
        mouseZ = 0;
    };

    var handleMouseUp = function(event) {
        if (event.button == 0)
            dragging = false;
    };

    var handleMouseDown = function(event) {
        if (event.button == 0) {
            dragging = true;
            lastX = mouseX;
            lastY = mouseY;
        }
    };

    var handleMouseWheel = function(event) {
        mouseZ = event.deltaY;
    };

    var handleZoomIn = function(event) {
        if (event.button == 0) {
            if (event.type === "mousedown")
                zoomInHeld = true
            else if (event.type === "mouseup")
                zoomInHeld = false;
        }
        if (event.type === "mouseleave")
            zoomInHeld = false;
    };

    var handleZoomOut = function(event) {
        if (event.button == 0) {
            if (event.type === "mousedown")
                zoomOutHeld = true
            else if (event.type === "mouseup")
                zoomOutHeld = false;
        }
        if (event.type === "mouseleave")
            zoomOutHeld = false;
    };

    var handleResetView = function(event) {
        zoom = this.minZoom;
        camX = 0;
        camY = 0;
    };

    var handleProgress = function(event) {
        if (event.button == 0) {
            if (event.type === "mousedown")
                progressHeld = true
            else if (event.type === "mouseup")
                progressHeld = false;
        }
        if (event.type === "mouseleave")
            progressHeld = false;
        if (progressHeld) {
            var progress = (event.clientX - widgets.progress.offsetLeft) / widgets.progress.clientWidth;
            progress = clamp01 (progress);

            this.pause ();
            timer.elapsed = timer.duration * progress;
            widgets.progress.childNodes [1].style.width = (progress * 100).toString () + "%";

            widgets.progress.style.cursor = "grabbing";
            widgets.progress.style.cursor = "-webkit-grabbing";
        } else {
            widgets.progress.style.cursor = "pointer";
        }
    };

    var requestTick = (function() {
        var _request = window.webkitRequestAnimationFrame
        || window.mozRequestAnimationFrame
        || window.oRequestAnimationFrame
        || window.msRequestAnimationFrame
        || function(callback, element) {
            window.setTimeout(callback, 1000 / 60);
        };
        return function(callback, period) {
            _request(callback);
        }
    })();

    var cancelTick = function (id) {
        window.cancelAnimationFrame (id);
    };

    var tick = function () {
        var now = Date.now ();
        if (lastFrameTime == 0)
            lastFrameTime = now;

        deltaSeconds = (now - lastFrameTime) * MILLI_TO_SECONDS;
        totalSeconds += deltaSeconds;

        draw ();

        frames++;
        lastFrameTime = now;
        tickId = requestTick(tick);
    }.bind (this);

    var draw = function () {
        if (dragging) {
            canvas.style.cursor = "grabbing";
            canvas.style.cursor = "-webkit-grabbing";

            var dragX = mouseX - lastX;
            var dragY = mouseY - lastY;

            camX += dragX;
            camY += dragY;

            lastX = mouseX;
            lastY = mouseY;
        } else {
            canvas.style.cursor = "grab";
            canvas.style.cursor = "-webkit-grab";
        }

        if (zoomInHeld) {
            zoom += zoomSpeed;
        } else if (zoomOutHeld) {
            zoom -= zoomSpeed;
        } else if (mouseZ != 0) {
            var sign = mouseZ > 0 ? 1 : -1;
            var normalise = mouseZ / mouseZ;
            zoom += -sign * normalise * zoomSpeedWheel;
        }
        zoom = clamp (zoom, this.minZoom, this.maxZoom);

        var progress = timer.progress();
        if (playing) {
            timer.elapsed += deltaSeconds;
            widgets.progress.childNodes [1].style.width = (progress * 100).toString () + "%";
        }
        if (timer.finished()) {
            playing = false;

            // show play icon.
            widgets.play.childNodes[1].hidden = false;
            widgets.play.childNodes[3].hidden = true;
        }

        context.setTransform (1, 0, 0, 1, 0, 0);
        context.fillStyle = this.bgColor;
        context.fillRect (0,0,canvas.width,canvas.height);

        mat2d.identity (view);
        mat2d.scale (view, view, vec2.fromValues (zoom, zoom));
        mat2d.translate (view, view, vec2.fromValues (camX, camY));

        mat2d.mul (viewProj, view, proj);

        // half-pixel offset.
        mat2d.translate (viewProj, viewProj, vec2.fromValues (0.5, 0.5));

        mat2d.invert (invView, view);
        mat2d.invert (invProj, proj);
        mat2d.invert (invViewProj, viewProj);

        context.setTransform (
            viewProj[0],
            viewProj[1],
            viewProj[2],
            viewProj[3],
            viewProj[4],
            viewProj[5]
        );

        drawGrid (canvas.width, canvas.height, 32, 32);
        drawLines (config.points, progress);

        // FIXME: reset mouse z for the next frame.
        mouseZ = 0;
    }.bind (this);

    var drawGrid = function(width, height, deltaX, deltaY) {
        var stepsX = Math.ceil(width / deltaX);
        var stepsY = Math.ceil(height / deltaY);

        var halfWidth = stepsX * deltaX / 2;
        var halfHeight = stepsY * deltaY / 2;

        var topleft = vec2.fromValues (-halfWidth, -halfHeight);
        var bottomright = vec2.fromValues (halfWidth, halfHeight);

        var screenCenter = vec2.fromValues (canvas.width / 2, canvas.height / 2);
        vec2.transformMat2d (screenCenter, screenCenter, invViewProj);

        vec2.add (topleft, topleft, screenCenter);
        vec2.add (bottomright, bottomright, screenCenter);

        var left = topleft [0];
        var top = topleft [1];
        var right = bottomright [0];
        var bottom = bottomright [1];

        var center = vec2.fromValues (camX, camY);
        vec2.transformMat2d (center, center, invView);

        var marginTopLeft = vec2.fromValues (20, 10);
        vec2.transformMat2d (marginTopLeft, marginTopLeft, invViewProj);

        var marginBottomRight = vec2.fromValues (canvas.width - 10, canvas.height - 10);
        vec2.transformMat2d (marginBottomRight, marginBottomRight, invViewProj);

        var ax = 0;
        var ay = 0;

        if (center[0] > marginBottomRight[0])
            ax = marginBottomRight[0];
        else if (center[0] < marginTopLeft[0])
            ax = marginTopLeft[0];

        if (center[1] > marginBottomRight[1])
            ay = marginBottomRight[1];
        else if (center[1] < marginTopLeft[1])
            ay = marginTopLeft[1];

        context.save ();

        // label x-axis.
        context.font = this.axisFontSize.toString() + "px" + " " + this.axisFont;
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = this.axisLabelColor;
        for (var x = 0; x <= right; x+=deltaX) {
            context.fillText((x).toFixed(0), x, ay);
        }
        for (var x = 0; x >= left; x-=deltaX) {
            context.fillText((x).toFixed(0), x, ay);
        }

        // label y-axis.
        context.font = this.axisFontSize.toString() + "px" + " " + this.axisFont;
        context.textAlign = "right";
        context.textBaseline = "middle";
        context.fillStyle = this.axisLabelColor;
        for (var y = 0; y <= bottom; y+=deltaY) {
            context.fillText((y).toFixed(0), ax, y);
        }
        for (var y = 0; y >= top; y-=deltaY) {
            context.fillText((y).toFixed(0), ax, y);
        }

        context.beginPath ();
        context.lineWidth = 1;
        context.strokeStyle = this.axisLineColor;

        // x-axis.
        for (var x = 0; x <= right; x+=deltaX) {
            context.moveTo (x, top);
            context.lineTo (x, bottom);
        }
        for (var x = 0; x >= left; x-=deltaX) {
            context.moveTo (x, top);
            context.lineTo (x, bottom);
        }
        // y-axis.
        for (var y = 0; y <= bottom; y+=deltaY) {
            context.moveTo (left, y);
            context.lineTo (right, y);
        }
        for (var y = 0; y >= top; y-=deltaY) {
            context.moveTo (left, y);
            context.lineTo (right, y);
        }
        context.stroke ();

        context.restore ();
    }.bind(this);

    var drawLines = function(points, progress, closed) {
        var closed = closed || true;
        var numLines = closed ? points.length : points.length - 1;
        var wholeLines = Math.floor (progress * numLines);
        var subProgress = (progress * numLines) - wholeLines;

        // colored line segments, instead of a continuous path.
        for (var i = 0; i < wholeLines; i++) {
            var p1 = points [i];
            var p2 = points [(i + 1) % points.length];

            context.beginPath ();
            context.moveTo (p1.x, p1.y);
            context.lineTo (p2.x, p2.y);
            context.lineWidth = p1.size || 1;
            context.strokeStyle = p1.color || this.defaultLineColor;
            context.stroke ();
        }

        if (wholeLines == points.length)
            return;

        // interpolate.
        var from = points [wholeLines];
        var to = points [(wholeLines + 1) % points.length];
        var x = from.x + (to.x - from.x) * subProgress;
        var y = from.y + (to.y - from.y) * subProgress;

        context.beginPath ();
        context.moveTo (from.x, from.y);
        context.lineTo (x, y);
        context.lineWidth = from.size || 1;
        context.strokeStyle = from.color || this.defaultLineColor;
        context.stroke ();
    }.bind(this);

    this.toggle = function () {
        if (playing)
            this.pause ();
        else
            this.play ();
    };

    this.play = function (duration) {
        playing = true;

        timer.duration = duration || 5;
        if (timer.finished())
            timer.elapsed = 0;

        // show pause icon.
        widgets.play.childNodes[1].hidden = true;
        widgets.play.childNodes[3].hidden = false;
    };

    this.pause = function () {
        playing = false;

        // show play icon.
        widgets.play.childNodes[1].hidden = false;
        widgets.play.childNodes[3].hidden = true;
    };

    var Timer = function (_duration) {
        this.elapsed = 0;
        this.duration = _duration;
        this.progress = function () {
            return clamp01 (this.elapsed / this.duration);
        };
        this.finished = function () {
            return this.elapsed >= this.duration;
        };
    };

    var lerp = function (a, b, progress) {
        return a + (b - a) * progress;
    };

    var clamp = function (value, min, max) {
        if (value < min)
            return min;
        else if (value > max)
            return max;
        else
            return value;
    };

    var clamp01 = function (value) {
        return clamp (value, 0, 1);
    };
};
