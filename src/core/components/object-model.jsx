import React, { Component, } from "react"
import PropTypes, { func } from "prop-types"
import { List } from "immutable"
import ImPropTypes from "react-immutable-proptypes"
import jsonld from "jsonld"

const braceOpen = "{"
const braceClose = "}"
const propClass = "property"

const basename = (path) => {
    return path.replace(/.*\/|\.[^.]*$/g, "")
 }


/** Hacky function to associate a jsonld context to a schema. */
const contestualizza = (key, ctx, getComponent) => {
  console.log("contestualizza", key, ctx)
  if (!ctx) return "No semantics"
  if (typeof ctx !== "object") return "Only object contexts are supported"
  if (!Object.keys(ctx).length) return "No semantics"

  let field = ctx.get(key)
  let vocab = ctx.get("@vocab") || ""
  let vocabularyUri = null
  let ns = ""
  if (field === null) {
    return "No semantics"
  }
  if (field === undefined) {
    field = key
  }
  if (typeof field !== "string") {
    const fieldCtx = field.get("@context")
    field = field.get("@id")
    vocabularyUri = fieldCtx && fieldCtx.get("@base") && fieldCtx.get("@base").replace(/[/#]$/, "") || null
  }
  console.log("field", field, "type", typeof field)
  if (typeof field === "string" && field.includes(":")) {
    console.log("processing : field", field)
    const [a, b] = field.split(":", 2)
    field = b
    ns = a
    vocab = ctx.get(ns) || ""
  }

  // "https://w3id.org/italia/controlled-vocabulary/classifications-for-people/education-level"
  return (
    <div>
      <a href={vocab + field}>
        {(ns ? ns + ":" : "" )+ field}
      </a>&nbsp;
      <span><DictModel url={ vocabularyUri } getComponent={getComponent}/></span>
    </div>
  )
}

//    "https://virtuoso-dev-external-service-ndc-dev.apps.cloudpub.testedev.istat.it/sparql";

export class DictModel extends Component {
  static propTypes = {
    url: PropTypes.string.isRequired,
    getComponent: PropTypes.func.isRequired,
  }


  getOntology = () => {
    const query = `
      prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      select distinct * where {
        ?field rdfs:domain ?domain .
        ?field rdfs:range ?class .
        ?class _:b1 <${this.props.url}>
      }
      `
    const url = "https://ontopia-virtuoso.agid.gov.it/sparql"
    const jsonpUri = url + "?format=json&query=" + encodeURIComponent(query)
    const endpoint = "http://0.0.0.0:5000/" + jsonpUri

    fetch(endpoint)
      .then((response) => {
        if (!response.ok) {
          throw Error(response.statusText)
        }
        response.json()
        })
      .then((data) => {
        const triple = data.results.bindings[0]
        const content = Object.fromEntries(
          Object.entries(triple).map(
            ([k,v], i) => [k, v.value] )
        )
        console.log("semantic data", content)
        this.setState({data: content})
        })
      .catch((e) => {
        console.log("error fetching data from %s", endpoint, e)
        this.setState({data: {field: "Error fetching data", class: "", domain: ""}})
      })
  }

  render() {
    let { url, getComponent, ...otherProps } = this.props
    console.log("url", url, otherProps)
    const ModelCollapse = getComponent("ModelCollapse")

    if (!url) return <div>NoVoc</div>

    if (this.state == undefined) {
      try {
        this.getOntology()
      } catch {
        this.setState({data: {}})
      }
    }
    return (
      <div className="App">
        {
          this.state && this.state.data &&
          <div style={{backgroundColor: "lightyellow"}}>
            <ModelCollapse isOpened={false} title={"Vocabulary"}><br/>

            <br/><a href={url} title={ "This value is relative to the vocabulary " + url } >Vocabulary URL</a>
            <br/>Entry RDF Type: <a href={this.state.data.class}> { basename(this.state.data.class)}</a>
            <br/>Property <a href={this.state.data.field}> { basename(this.state.data.field)}</a>
            <br/>of Class <a href={this.state.data.domain}>{ basename(this.state.data.domain)}</a>
            </ModelCollapse>
          </div>
        }
      </div>
    )
  }
}


export default class ObjectModel extends Component {
  static propTypes = {
    schema: PropTypes.object.isRequired,
    getComponent: PropTypes.func.isRequired,
    getConfigs: PropTypes.func.isRequired,
    expanded: PropTypes.bool,
    onToggle: PropTypes.func,
    specSelectors: PropTypes.object.isRequired,
    name: PropTypes.string,
    displayName: PropTypes.string,
    isRef: PropTypes.bool,
    expandDepth: PropTypes.number,
    depth: PropTypes.number,
    specPath: ImPropTypes.list.isRequired,
    includeReadOnly: PropTypes.bool,
    includeWriteOnly: PropTypes.bool,
  }


  async toRdf() {
    try {
      console.log(this)
      let doc = this.props.schema.get("example")
      if (doc && doc.toJS){
        doc = doc.toJS()
      }
      const ctx = this.props.schema.get("x-jsonld-context") && this.props.schema.get("x-jsonld-context").toJS() || {}
      doc["@context"] = ctx
      console.log("toRdf", doc)
      const rdfExample = await jsonld.toRDF(doc, { format: "application/n-quads" })
      if (!this.state) {
        this.setState({ rdfExample: rdfExample})
        console.log("rdfExample", rdfExample)
      }
    } catch (e) {
      console.error(e)
      return (
        <div>RDF example
          <pre>{e.message}</pre>
        </div>
      )
    }
  }


  render(){
    let { schema, name, displayName, isRef, getComponent, getConfigs, depth, onToggle, expanded, specPath, ...otherProps } = this.props
    let { specSelectors,expandDepth, includeReadOnly, includeWriteOnly} = otherProps
    const { isOAS3 } = specSelectors

    if(!schema) {
      return null
    }

    const { showExtensions } = getConfigs()

    let jsonldContext = schema.get("x-jsonld-context") || {}
    let description = schema.get("description")
    let properties = schema.get("properties")
    let additionalProperties = schema.get("additionalProperties")
    let title = schema.get("title") || displayName || name
    let requiredProperties = schema.get("required")
    let infoProperties = schema
      .filter( ( v, key) => ["maxProperties", "minProperties", "nullable", "example"].indexOf(key) !== -1 )
    let deprecated = schema.get("deprecated")
    let example = schema.get("example") != undefined ? schema.get("example").toJS() : undefined

    const JumpToPath = getComponent("JumpToPath", true)
    const Markdown = getComponent("Markdown", true)
    const Model = getComponent("Model")
    const ModelCollapse = getComponent("ModelCollapse")
    const Property = getComponent("Property")

    const JumpToPathSection = () => {
      return <span className="model-jump-to-path"><JumpToPath specPath={specPath} /></span>
    }
    const collapsedContent = (<span>
        <span>{ braceOpen }</span>...<span>{ braceClose }</span>
        {
          isRef ? <JumpToPathSection /> : ""
        }
    </span>)

    const anyOf = specSelectors.isOAS3() ? schema.get("anyOf") : null
    const oneOf = specSelectors.isOAS3() ? schema.get("oneOf") : null
    const not = specSelectors.isOAS3() ? schema.get("not") : null

    const titleEl = title && <span className="model-title">
      { isRef && schema.get("$$ref") && <span className="model-hint">{ schema.get("$$ref") }</span> }
      <span className="model-title__text">{ title }</span>
    </span>

    const jsonldPlaygroundUrl = "https://json-ld.org/playground/#startTab=tab-expand&json-ld="
    const openInPlayground = (example && jsonldContext &&
      <a href={ jsonldPlaygroundUrl + encodeURIComponent(JSON.stringify({ "@context": jsonldContext, ...example}))} >Open in playground 🔗</a>
    )


    if (example && jsonldContext) { // FIXME: how to invoke this?
      this.toRdf()
    }
    return <span className="model">
      <ModelCollapse
        modelName={name}
        title={titleEl}
        onToggle = {onToggle}
        expanded={ expanded ? true : depth <= expandDepth }
        collapsedContent={ collapsedContent }>

         <span className="brace-open object">{ braceOpen }</span>
          {
            !isRef ? null : <JumpToPathSection />
          }
          <span className="inner-object">
            {
              <table className="model"><tbody>
              {
                !description ? null : <tr className="description">
                    <td>description:</td>
                    <td colSpan={2}>
                      <Markdown source={ description } />
                    </td>
                  </tr>
              }
              {
                !deprecated ? null :
                  <tr className={"property"}>
                    <td>
                      deprecated:
                    </td>
                    <td>
                      true
                    </td>
                  </tr>

              }
              {
                !(properties && properties.size) ? null : properties.entrySeq().filter(
                    ([, value]) => {
                      return (!value.get("readOnly") || includeReadOnly) &&
                        (!value.get("writeOnly") || includeWriteOnly)
                    }
                ).map(
                    ([key, value]) => {
                      let isDeprecated = isOAS3() && value.get("deprecated")
                      let isRequired = List.isList(requiredProperties) && requiredProperties.contains(key)

                      let classNames = ["property-row"]

                      if (isDeprecated) {
                        classNames.push("deprecated")
                      }

                      if (isRequired) {
                        classNames.push("required")
                      }

                      return (<tr key={key} className={classNames.join(" ")}>
                        <td>
                          { key }{ isRequired && <span className="star">*</span> }
                        </td>
                        <td>{jsonldContext && contestualizza(key, jsonldContext, getComponent)}</td>
                        <td>
                          <Model key={ `object-${name}-${key}_${value}` } { ...otherProps }
                                 required={ isRequired }
                                 getComponent={ getComponent }
                                 specPath={specPath.push("properties", key)}
                                 getConfigs={ getConfigs }
                                 schema={ value }
                                 depth={ depth + 1 } />
                        </td>
                      </tr>)
                    }).toArray()
              }
              {
                // empty row befor extensions...
                !showExtensions ? null : <tr><td>&nbsp;</td></tr>
              }
              {
                !showExtensions ? null :
                  schema.entrySeq().map(
                    ([key, value]) => {
                      if(key.slice(0,2) !== "x-") {
                        return
                      }

                      const normalizedValue = !value ? null : value.toJS ? value.toJS() : value

                      return (<tr key={key} className="extension">
                        <td>
                          { key }
                        </td>
                        <td>
                          { JSON.stringify(normalizedValue) }
                        </td>
                      </tr>)
                    }).toArray()
              }
              {
                !additionalProperties || !additionalProperties.size ? null
                  : <tr>
                    <td>{ "< * >:" }</td>
                    <td>
                      <Model { ...otherProps } required={ false }
                             getComponent={ getComponent }
                             specPath={specPath.push("additionalProperties")}
                             getConfigs={ getConfigs }
                             schema={ additionalProperties }
                             depth={ depth + 1 } />
                    </td>
                  </tr>
              }
              {
                !anyOf ? null
                  : <tr>
                    <td>{ "anyOf ->" }</td>
                    <td>
                      {anyOf.map((schema, k) => {
                        return <div key={k}><Model { ...otherProps } required={ false }
                                 getComponent={ getComponent }
                                 specPath={specPath.push("anyOf", k)}
                                 getConfigs={ getConfigs }
                                 schema={ schema }
                                 depth={ depth + 1 } /></div>
                      })}
                    </td>
                  </tr>
              }
              {
                !oneOf ? null
                  : <tr>
                    <td>{ "oneOf ->" }</td>
                    <td>
                      {oneOf.map((schema, k) => {
                        return <div key={k}><Model { ...otherProps } required={ false }
                                 getComponent={ getComponent }
                                 specPath={specPath.push("oneOf", k)}
                                 getConfigs={ getConfigs }
                                 schema={ schema }
                                 depth={ depth + 1 } /></div>
                      })}
                    </td>
                  </tr>
              }
              {
                !not ? null
                  : <tr>
                    <td>{ "not ->" }</td>
                    <td>
                      <div>
                        <Model { ...otherProps }
                               required={ false }
                               getComponent={ getComponent }
                               specPath={specPath.push("not")}
                               getConfigs={ getConfigs }
                               schema={ not }
                               depth={ depth + 1 } />
                      </div>
                    </td>
                  </tr>
              }
              </tbody></table>
          }
        </span>
        <span className="brace-close">{ braceClose }</span>
      </ModelCollapse>
      {
        infoProperties.size
          ? infoProperties.entrySeq().map( ( [ key, v ] ) => {
            if (!(key in ["example", "x-jsonld-context"])) { // exapmle is rendered below
              return <Property key={`${key}-${v}`} propKey={ key } propVal={ v } propClass={ propClass } />
            }
          })
          : null
      }
      <hr/>
      {
        example &&
              <ModelCollapse title={"Example in JSON and RDF:"} expanded={true}>
                  {openInPlayground}
                  <pre>{JSON.stringify(example, null, 2)}</pre>
                  <div style={{backgroundColor: "lightyellow"}}>
                    <pre>
                    {this.state && this.state.rdfExample || "Close and reopen the model to render the example."}
                    </pre>
                  </div>
              </ModelCollapse>
      }
      <hr/>
      <ModelCollapse title="JSON-LD Context">
        <pre>{ jsonldContext && JSON.stringify(jsonldContext, null, 2) || "{}"}</pre>
      </ModelCollapse>
    </span>
  }
}
