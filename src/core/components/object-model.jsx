import React, { Component, } from "react"
import PropTypes, { func } from "prop-types"
import { List } from "immutable"
import ImPropTypes from "react-immutable-proptypes"
import jsonld from "jsonld"

const braceOpen = "{"
const braceClose = "}"
const propClass = "property"

const basename = (path) => {
  try{
    return path.replace(/.*\/|\.[^.]*$/g, "")
  } catch(e) {
    return path
  }
 }


/** Hacky function to associate a jsonld context to a schema. */
const contestualizza = (key, jsonldContext) => {
  console.log("contestualizza", key, jsonldContext)
  if (!(key && jsonldContext)) return null

  let field = jsonldContext.get(key)
  let vocab = jsonldContext.get("@vocab") || ""
  let vocabularyUri = null
  let ns = ""
  if (field === null) {
    return null
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
    vocab = jsonldContext.get(ns) || ""
  }

  return { fieldName: field, fieldUri: vocab + field, vocabularyUri: vocabularyUri, ns: ns }
}

export class OntologyClassModel extends Component {
  static propTypes = {
    url: PropTypes.string.isRequired,
    getComponent: PropTypes.func.isRequired,
  }


  getOntology = () => {
    const query = `
      prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      select distinct * where {
        ?property rdfs:domain <${this.props.url}> .
        ?property rdfs:range ?range .

      }
      `
    const url = "https://virtuoso-dev-external-service-ndc-dev.apps.cloudpub.testedev.istat.it/sparql";
    const jsonpUri = url + "?format=json&query=" + encodeURIComponent(query)
    /// FIXME: set CORS on sparql endpoint and get rid of alloworigins.win.
    const endpoint = "https://api.allorigins.win/get?url=" + encodeURIComponent(jsonpUri)

    fetch(endpoint, {cache: "force-cache"})
      .then((response) => {
        console.log("response", response)
        if (!response.ok) {
          throw Error(response.statusText)
        }
        return response.json()
      })
      .then((data) => {
        console.log("fetched data", data)
        data = JSON.parse(data.contents) /// FIXME: remove this line after removing alloworigins.win
        const triple = data.results.bindings
        const content = Object.entries(triple).map(
            ([k, v], i) => [k, {property: v.property.value, range: v.range ? v.range.value: null}])
        
        console.log("rdf:type data", content)
        this.setState({ data: content })
      })
      .catch((e) => {
        console.log("error fetching data from %s", endpoint, e)
        this.setState({ data: null })
      })
  }

  render() {
    let { url, getComponent, ...otherProps } = this.props
    console.log("url", url, otherProps)
    const ModelCollapse = getComponent("ModelCollapse")

    if (!url) return <div>NoRDFType</div>

    if (this.state == undefined) {
      try {
        this.getOntology()
      } catch {
        this.setState({ data: [] })
      }
    }
    return (
      <div className="opblock opblock-patch opblock-description-wrapper">
        RDF Type: <a href={url} title={"This is the class " + url} target={"_blank"} rel={"noreferrer"}>
          {basename(url)}
        </a>
        &nbsp;
        {
          this.state && this.state.data &&
          <ModelCollapse title="Show details" expanded={true}>
            {
              this.state.data.map(([i, ontoProperty]) => {
                return (<span>
                  <br />➥
                  <a href={ontoProperty.property} target={"_blank"} rel={"noreferrer"} > {basename(ontoProperty.property)}</a>
                  [ <a href={ontoProperty.range} target={"_blank"} rel={"noreferrer"} >{basename(ontoProperty.range)}</a> ]
                </span>)
              })}
          </ModelCollapse>
        }
      </div>
    )
  }
}

export class ContextModel extends Component {
  static propTypes = {
    propertyName: PropTypes.string.isRequired,
    jsonldContext: PropTypes.string.isRequired,
    getComponent: PropTypes.func.isRequired,
  }

  render() {
    let { propertyName, jsonldContext, getComponent, ...otherProps } = this.props
    console.log("ContextModel", this.props)
    if (!jsonldContext) return "No semantics"
    if (typeof jsonldContext !== "object") return "Only object contexts are supported"
    if (!Object.keys(jsonldContext).length) return "No semantics"

    let ret = contestualizza(propertyName, jsonldContext)
    if (!ret) {
      return "No semantics"
    }
    let { fieldName: fieldName, fieldUri: fieldUri, vocabularyUri: vocabularyUri, ns: ns } = ret
    return (
      <div>
        <span><PropertyModel url={fieldUri} name={fieldName} ns={ns} getComponent={getComponent} /></span>
        <span><DictModel url={vocabularyUri} getComponent={getComponent} /></span>
      </div>
    )
  }
}

export class PropertyModel extends Component {
  static propTypes = {
    url: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    ns: PropTypes.string.isRequired,
    getComponent: PropTypes.func.isRequired,
  }


  getOntology = () => {
    const query = `
      prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      select distinct * where {
        <${this.props.url}>
          rdfs:domain ?domain ;
          rdfs:range ?class
        .
      }
      `
    const url = "https://virtuoso-dev-external-service-ndc-dev.apps.cloudpub.testedev.istat.it/sparql";
    const jsonpUri = url + "?format=json&query=" + encodeURIComponent(query)
    /// FIXME: set CORS on sparql endpoint and get rid of alloworigins.win.
    const endpoint = "https://api.allorigins.win/get?url=" + encodeURIComponent(jsonpUri)

    fetch(endpoint, {cache: "force-cache"})
      .then((response) => {
        console.log("response", response)
        if (!response.ok) {
          throw Error(response.statusText)
        }
        return response.json()
      })
      .then((data) => {
        console.log("fetched data", data)
        data = JSON.parse(data.contents) /// FIXME: remove this line after removing alloworigins.win
        const triple = data.results.bindings[0]
        const content = Object.fromEntries(
          Object.entries(triple).map(
            ([k, v], i) => [k, v.value])
        )
        console.log("semantic data", content)
        this.setState({ data: content })
      })
      .catch((e) => {
        console.log("error fetching data from %s", endpoint, e)
        this.setState({ data: null })
      })
  }

  render() {
    let { url, name, ns, getComponent, ...otherProps } = this.props
    console.log("url", url, otherProps)
    const ModelCollapse = getComponent("ModelCollapse")

    if (!url) return <div>NoSemantic</div>

    if (this.state == undefined) {
      try {
        this.getOntology()
      } catch {
        this.setState({ data: {} })
      }
    }
    return (
      <div className="opblock opblock-get opblock-description-wrapper">
        {
          this.state && this.state.data && <a href={this.state.data.domain}
              target={"_blank"} rel={"noreferrer"} title={ name + " is a property of " + this.state.data.domain}
            >{basename(this.state.data.domain)}</a> || <span>No semantics</span>
        }
        :
        <a href={url} title={"This is the property " + url} target={"_blank"} rel={"noreferrer"}>
          {(ns ? ns + ":" : "") + name}
          </a>
        &nbsp;
        {
          this.state && this.state.data && <a href={this.state.data.class} title={"The value of " + name + " is a " + this.state.data.class} 
              target={"_blank"} rel={"noreferrer"}
            >[{basename(this.state.data.class)}]</a>
        }
      </div>
    )
  }
}


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
    const url = "https://virtuoso-dev-external-service-ndc-dev.apps.cloudpub.testedev.istat.it/sparql";
    const jsonpUri = url + "?format=json&query=" + encodeURIComponent(query)
    /// FIXME: set CORS on sparql endpoint and get rid of alloworigins.win.
    const endpoint = "https://api.allorigins.win/get?url=" + encodeURIComponent(jsonpUri)

    fetch(endpoint, {cache: "force-cache"})
      .then((response) => {
        console.log("response", response)
        if (!response.ok) {
          throw Error(response.statusText)
        }
        return response.json()
      })
      .then((data) => {
        console.log("fetched data", data)
        data = JSON.parse(data.contents) /// FIXME: remove this line after removing alloworigins.win
        const triple = data.results.bindings[0]
        const content = Object.fromEntries(
          Object.entries(triple).map(
            ([k, v], i) => [k, v.value])
        )
        console.log("semantic data", content)
        this.setState({ data: content })
      })
      .catch((e) => {
        console.log("error fetching data from %s", endpoint, e)
        this.setState({ data: null })
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
        this.setState({ data: {} })
      }
    }
    return (
      <div className="opblock opblock-get opblock-description-wrapper">
        Vocabulary <a href={url} title={"This value is relative to the vocabulary " + url} target={"_blank"} rel={"noreferrer"}>URI 🔗</a>
        &nbsp;
        {
          this.state && this.state.data &&
          <ModelCollapse isOpened={false} title={"See more"}>

            <br />Entry RDF Type: <a href={this.state.data.class}
              target={"_blank"} rel={"noreferrer"}
            > {basename(this.state.data.class)} 🔗</a>
            <br />Property <a href={this.state.data.field}
              target={"_blank"} rel={"noreferrer"}
            > {basename(this.state.data.field)} 🔗</a>
            <br />of Class <a href={this.state.data.domain}
              target={"_blank"} rel={"noreferrer"}
            >{basename(this.state.data.domain)} 🔗</a>
          </ModelCollapse>
        }
      </div>
    )
  }
}

class OntoScore extends Component {
  static propTypes = {
    semanticScore: PropTypes.object.isRequired,
  }

  render() {
    let { semanticScore } = this.props
    return <span 
      style={{float: "right"}}
      className={ "opblock " + (
         semanticScore.ratio > 0.9 ? "opblock-post"
        : semanticScore.ratio > 0.5 ? "opblock-get" 
        : "opblock-delete") } >&nbsp;{"OntoScore: " + semanticScore.ratio}</span>
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
      const jsonldContext = this.props.schema.get("x-jsonld-context") && this.props.schema.get("x-jsonld-context").toJS() || {}
      doc["@context"] = jsonldContext
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

  evaluateSemanticScore = (properties, jsonldContext) => {
    let countSemantic = 0
    console.log("jsonldContext", jsonldContext, properties)
    if (jsonldContext && (jsonldContext.entrySeq !== undefined)) {
      jsonldContext.entrySeq().toArray().map(
        ([key,]) => {
          const semanticReference = properties.get(key)
          if (semanticReference != undefined && semanticReference != null) {
            countSemantic++
          }
        })
    }

    const countProperties = properties ? properties.count() : 0
    return {
      countProperties: countProperties, countSemantic: countSemantic, ratio:
        (countProperties > 0 ? countSemantic / countProperties : 0)
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
    let jsonldType = schema.get("x-jsonld-type") || null
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

    // Evaluate semantic score.
    const semanticScore = this.evaluateSemanticScore(properties, jsonldContext)

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
      <a
        href={ jsonldPlaygroundUrl + encodeURIComponent(JSON.stringify({ "@context": jsonldContext, ...example}))}
        target={"_blank"}
        rel={"noreferrer"} >Open in playground 🔗</a>
    )


    if (example && jsonldContext) { // FIXME: how to invoke this?
      this.toRdf()
    }
    return <span className="model">
      <OntoScore semanticScore={semanticScore} />
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

                      console.log("key", key, jsonldContext)
                      return (<tr key={key} className={classNames.join(" ")}>
                        <td>
                          { key }{ isRequired && <span className="star">*</span> }
                        </td>
                        <td>{jsonldContext && <ContextModel propertyName={key} jsonldContext={jsonldContext} getComponent={getComponent} />}</td>
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
      {
        infoProperties.size
          ? infoProperties.entrySeq().map( ( [ key, v ] ) => {
            if (!(key in ["example", "x-jsonld-context"])) { // example is rendered below
              return <Property key={`${key}-${v}`} propKey={ key } propVal={ v } propClass={ propClass } />
            }
          })
          : null
      }
      <hr/>
      {
        example &&
              <ModelCollapse title={"Example"} >
                  {openInPlayground}
                  <div style={{display: "flex"}} className={ "opblock opblock-post opblock-description-wrapper" } >
                    <div style={{width: "50%", height: "100%"}}>
                      JSON
                      <pre>{JSON.stringify(example, null, 2)}</pre></div>
                    <div style={{width: "50%", height: "100%"}}>
                      RDF
                      <pre style={{wordWrap: "break-word", overflowX: "auto", height: "100%", border: "solid 1px"}}>{ this.state ? this.state.rdfExample : "Close and reopen the model to render the example." }</pre>
                    </div>
                  </div>
              </ModelCollapse>
      }
      <hr/>
      <ModelCollapse title="JSON-LD Context">
        <pre>{ jsonldContext ? JSON.stringify(jsonldContext, null, 2) : "{}"}</pre>
      </ModelCollapse>
      
      <OntologyClassModel url={jsonldType} getComponent={getComponent} />

    </ModelCollapse>
    </span>
  }
}
