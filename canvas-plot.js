
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
    var world = null;

    var widgets = {
        canvas: null,
        play: null,
        progress: null,
        zoom: null,
    };

    var playing = false;
    var elapsed = 0;
    var duration = 0;

    var camX = 0;
    var camY = 0;
    var mouseX = 0;
    var mouseY = 0;
    var lastX = 0;
    var lastY = 0;

    var dragging = false;

    this.minZoom = 1;
    this.maxZoom = 3;
    this.bgColor = "#eee";
    this.axisFont = "8px Arial";
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

        widgets.play = document.getElementById ('play-widget');

        widgets.progress = document.getElementById ('progress-widget');
        widgets.progress.addEventListener('input', handleProgressChange.bind(this));
        widgets.progress.addEventListener('change', handleProgressChange.bind(this));

        widgets.zoom = document.getElementById ('zoom-widget');

        context = canvas.getContext('2d');

        camX = canvas.width / 2;
        camY = canvas.height / 2;

        world = new Matrix3 ();
        timer = new Timer (5);
    }.bind(this);

    var handleMouseEnter = function(event) {
        mouseX = event.clientX - canvas.offsetLeft;
        mouseY = event.clientY - canvas.offsetTop;
    };

    var handleMouseLeave = function(event) {
        dragging = false;
    };

    var handleMouseMove = function(event) {
        mouseX = event.clientX - canvas.offsetLeft;
        mouseY = event.clientY - canvas.offsetTop;
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
        widgets.zoom.value = parseInt(widgets.zoom.value) - event.deltaY;
    };

    var handleProgressChange = function(event) {
        this.pause ();
        timer.elapsed = event.target.value / event.target.max * timer.duration;
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
        context.setTransform (1, 0, 0, 1, 0, 0);
        context.fillStyle = this.bgColor;
        context.fillRect (0,0,canvas.width,canvas.height);

        if (dragging) {
            var dragX = mouseX - lastX;
            var dragY = mouseY - lastY;

            camX += dragX;
            camY += dragY;

            lastX = mouseX;
            lastY = mouseY;
        }

        var zoomProgress = parseInt(widgets.zoom.value) / parseInt(widgets.zoom.max);
        var zoom = this.minZoom + (this.maxZoom - this.minZoom) * zoomProgress;

        world.translate (camX, camY);
        world.scale (zoom, zoom);

        context.setTransform (
            world.mat[0],
            world.mat[1],
            world.mat[2],
            world.mat[3],
            world.mat[4] + 0.5,
            world.mat[5] + 0.5
        );

        if (timer.finished()) {
            playing = false;

            // show play icon.
            widgets.play.childNodes[1].hidden = false;
            widgets.play.childNodes[3].hidden = true;
        }

        var progress = timer.progress();
        if (playing) {
            timer.elapsed += deltaSeconds;
            widgets.progress.value = progress * widgets.progress.max;
        }

        drawGrid (canvas.width, canvas.height, 32, 32);
        drawLines (config.points, progress);
        drawGridLabels (canvas.width, canvas.height, 32, 32);
    }.bind (this);

    var drawGrid = function(width, height, deltaX, deltaY) {
        var stepsX = Math.ceil(width / deltaX);
        var stepsY = Math.ceil(height / deltaY);

        var halfWidth = stepsX * deltaX / 2;
        var halfHeight = stepsY * deltaY / 2;

        var topleft = [0 - halfWidth, 0 - halfHeight];
        var bottomright = [0 + halfWidth, 0 + halfHeight];

        //var topleft = world.transformPoint (-halfWidth, -halfHeight);
        //var bottomright = world.transformPoint (halfWidth, halfHeight);

        var left = topleft [0];
        var top = topleft [1];
        var right = bottomright [0];
        var bottom = bottomright [1];

        context.save ();

        context.beginPath ();
        for (var x = left; x <= right; x+=deltaX) {
            context.moveTo (x, top);
            context.lineTo (x, bottom);
        }
        for (var y = top; y <= bottom; y+=deltaY) {
            context.moveTo (left, y);
            context.lineTo (right, y);
        }
        context.lineWidth = 1;
        context.strokeStyle = this.axisLineColor;
        context.stroke ();

        for (var x = left; x <= right; x+=deltaX) {
            context.font = this.axisFont;
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillStyle = this.axisLabelColor;
            context.fillText(x.toFixed(0), x, 0);
        }
        for (var y = top; y <= bottom; y+=deltaY) {
            context.font = this.axisFont;
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillStyle = this.axisLabelColor;
            context.fillText(y.toFixed(0), 0, y);
        }

        context.restore ();
    }.bind(this);

    var drawGridLabels = function(width, height, deltaX, deltaY) {
        var stepsX = Math.ceil(width / deltaX);
        var stepsY = Math.ceil(height / deltaY);

        var halfWidth = stepsX * deltaX / 2;
        var halfHeight = stepsY * deltaY / 2;

        var topleft = [0 - halfWidth, 0 - halfHeight];
        var bottomright = [0 + halfWidth, 0 + halfHeight];

        //var topleft = world.transformPoint (-halfWidth, -halfHeight);
        //var bottomright = world.transformPoint (halfWidth, halfHeight);

        var left = topleft [0];
        var top = topleft [1];
        var right = bottomright [0];
        var bottom = bottomright [1];

        context.save ();

        for (var x = left; x <= right; x+=deltaX) {
            context.font = this.axisFont;
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillStyle = this.axisLabelColor;
            context.fillText(x.toFixed(0), x, 0);
        }
        for (var y = top; y <= bottom; y+=deltaY) {
            context.font = this.axisFont;
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillStyle = this.axisLabelColor;
            context.fillText(y.toFixed(0), 0, y);
        }

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

    var Matrix3 = function () {
        this.mat = [1,0,0,1,0,0,0,0,1];

        this.identity = function () {
            this.mat [0] = 1;
            this.mat [1] = 0;
            this.mat [2] = 0;
            this.mat [3] = 1;
            this.mat [4] = 0;
            this.mat [5] = 0;
            this.mat [6] = 0;
            this.mat [7] = 0;
            this.mat [8] = 1;
        }
        this.scale = function (x, y) {
            this.mat [0] = x;
            this.mat [3] = y;
        };
        this.skew = function (x, y) {
            this.mat [1] = x;
            this.mat [2] = y;
        };
        this.translate = function (x, y) {
            this.mat [4] = x;
            this.mat [5] = y;
        };
        this.transformPoint = function (x, y) {
            return [
                this.mat[0] * x + this.mat[2] * y + this.mat[4],
                this.mat[1] * x + this.mat[3] * y + this.mat[5]
            ]
        };
    };

    var Timer = function (_duration) {
        this.elapsed = 0;
        this.duration = _duration;
        this.progress = function () {
            return clamp01 (this.elapsed / this.duration, 0);
        };
        this.finished = function () {
            return this.elapsed >= this.duration;
        };
        var clamp01 = function (value) {
            if (value > 1)
                return 1;
            else if (value < 0)
                return 0;
            else
                return value;
        };
    };
};
