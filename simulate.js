import * as Dynamics from './dynamics.js';
import Vector from './vector.js';

class Layer {
    constructor() {
        this.id = Layer.unique;
    }

    static get unique() {
        return 0; //todo
    }
}

export class World {
    /**
     * @param {*} ctx the canvas drawing context.
     * @param {boolean} debug whether to run in debug mode.
     * @param {number} fps maximum frames per second.
     * @param {number} cps maximum calculations per second (i.e. simulation granularity).
     */
    constructor(ctx, debug=false, fps=60, cps=200) {
        // rendering properties
        this.ctx = ctx;
        this.debug = debug;

        // body managers
        this.staticBodies = [];
        this.kinematicBodies = [];
        this.dynamicBodies = [];

        // time stepping properies
        this.fps = fps;
        this.dt = 1 / cps;
        this.acc = 0;
        this.stepLimit = 10; // maximum nuumber of steps per update
    }

    get allBodies() {
        return this.staticBodies.concat(this.kinematicBodies).concat(this.dynamicBodies);
    }

    /**
     * Add a new body to the world.
     * @param {Dynamics.Body} body
     */
    addBody(body) {
        if (body instanceof Dynamics.DynamicBody) {
            this.dynamicBodies.push(body);
        }
        else if (body instanceof Dynamics.StaticBody) {
            this.staticBodies.push(body);
        }
        else {
            this.kinematicBodies.push(body);
        }
    }

    /**
     * Collects all pairs of bodies that are close enough to collide.
     * Note that this list may have false positives but never false negatives.
     * @returns {Body[][]} a list of pairs of bodies that could potentially collide.
     */
    broadPhaseCollision() {
        const pairs = [];
        for (let i = 0; i < this.allBodies.length; i++) {
            for (let j = i+1; j < this.allBodies.length; j++) {
                const a = this.allBodies[i], b = this.allBodies[j];
                if (a instanceof Dynamics.DynamicBody || b instanceof Dynamics.DynamicBody) {
                    pairs.push([a, b]);
                }
            }
        }
        return pairs;
    }

    /**
     * Brute force resolves the collisions between all pairs of bodies in a list.
     * @param {Body[][]} bodyPairs
     */
    narrowPhaseCollision(bodyPairs) {
        bodyPairs.forEach(pair => {
            const a = pair[0], b = pair[1];
            const collision = new Dynamics.Collision(a, b);
            if (collision.detect()) {
                collision.resolve();
                //console.log('Collision detected')
            }
        });
    }

    /**
     * Detects and resolves every dynamic collision.
     */
    resolveCollisions() {
        this.narrowPhaseCollision(this.broadPhaseCollision());
    }

    /**
     * Resolves collisions and updates the simulated bodies by `dt`.
     * @param {Number} dt change in time.
     */
    step(dt) {
        // integrate forces to produce new velocities
        this.dynamicBodies.concat(this.kinematicBodies).forEach(b => {
            b.velocity = b.velocity.add(b.acceleration.scale(dt));
            b.force = Vector.ZERO;
        })

        // generate collision impulses to correct velocity errors
        this.resolveCollisions();
        this.dynamicBodies.concat(this.kinematicBodies).forEach(b => {
            b.velocity = b.velocity.add(b.impulse.scale(b.inv_mass));
            b.impulse = Vector.ZERO;
        })

        // update positions using new velocities
        this.dynamicBodies.concat(this.kinematicBodies).forEach(b => {
            b.translate(b.velocity.scale(dt));
            b.translate(b.correction)
            b.correction = Vector.ZERO;
        })

/*
        this.resolveCollisions();
        this.kinematicBodies.forEach(e => e.update(dt));
        this.dynamicBodies.forEach(e => e.update(dt));

*/

        // gravity
        //this.dynamicBodies.forEach(e => e.addForce(new Vector(0, 100).scale(e.mass)));
    }

    /**
     * Performs `this.cps` simulation steps per second to update the simulation.
     * @param {*} t time of the simulation in seconds.
     */
    update(t) {
        // update the accumulator
        if (this.lastUpdate != undefined) {
            this.acc += t - this.lastUpdate;
        }
        this.lastUpdate = t;

        // clamp upper value of accumulator to reduce number of steps when too much load
        const accMax = this.dt * this.stepLimit;
       // console.log('acc:', this.acc, 'max:', accMax, 'min:', this.dt)
        if (this.acc > accMax) {
            console.log('Simulation throttled:', this.acc - accMax, 'second delay.')
            this.acc = accMax;
        }

        // step the simulation in discrete `dt` sized chunks of time
        for (; this.acc >= this.dt; this.acc -= this.dt) {
            this.step(this.dt);
        }
    }

    /**
     * Renders every body onto the cavnas using their `.draw()` method.
     */
    render(t) {
        // linear interpolation using remaining accumulator value TODO
        const interpolation = this.acc / this.dt;

        this.allBodies.forEach(e => {
            e.draw(this.ctx);
            if (this.debug) {
                e.trace(this.ctx);
            }
        });
    }

    /**
     * Launch simulation event loop.
     * @param {*} t 
     */
    run(t) {
        if (t == undefined) {
            t = performance.now();
        }
        t /= 1000; // scale time to seconds

        this.render(t);
        this.update(t);
        requestAnimationFrame(t => this.run(t));
    }
}