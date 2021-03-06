var Model = require("../lib/model");
var Caplet = require("../lib");
var expect = require("expect.js");
var runloop    = require("watchable-object/lib/runloop").instance;

describe(__filename + "#", function() {

  it("can grab a reference to a property", function() {
    var m = new Model({ name: "abba" });
    var ref = Caplet.reference(m, "name");
    expect(ref.value).to.be("abba");
  });

  it("changes the value on the ref if the target changes", function() {
    var m = new Model({ name: "abba" });
    var ref = Caplet.reference(m, "name");
    m.set("name", "baab");
    runloop.runNow();
    expect(ref.value).to.be("baab");
  });

  it("changes the referenced value if value on ref changes", function() {
    var m = new Model({ name: "abba" });
    var ref = Caplet.reference(m, "name");
    ref.set("value", "baab");
    runloop.runNow();
    expect(m.name).to.be("abba");
  });
});
