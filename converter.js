const fs = require("fs");
const process = require("process");

global.g = ''; // 原始json信息
allSchemas = '';

function markdownText(instance) {
    global.g = instance;
    allSchemas = global.g.components.schemas;
    var mdOutList = [];
    if (instance != null && instance != undefined) {
        createBasicInfo(instance , mdOutList);
        createTagsInfo(instance, mdOutList);
    }
    return mdOutList.join('\n');
}


function getSchemaExample(schemaName, newSchemaList){
    if(allSchemas[schemaName]){
        let props = allSchemas[schemaName].properties;
        let exp = getExampleFromSchemaProperties(props,newSchemaList);
        let e = exp;
        return JSON.stringify(e,null,"    ");
    }else{
        switch(schemaName){
            case "string":
                return '"string"';
            case "integer":
                return "0";
            case "number":
                return "0.0";
            default:
                return "null";
        }
    }
    
}



let getExampleFromSchemaProperties = (props , newSchemaList)=>{
    let propValueList = {}
    let e = [];
    for(let propName in props){
        let propExample = getExampleFromSchemaProperty(props[propName],e);
        e.forEach(a=>{
            newSchemaList.push(a);
        });
        propValueList[propName] = propExample;
    }
    return propValueList;
}


let getExampleFromSchemaProperty = (prop , newSchemaList)=>{
    if(prop["$ref"]){
        let type = prop["$ref"].split("/").pop();
        return getExampleFromSchemaProperties(allSchemas[type].properties,newSchemaList );
    }else{
        if(prop.type === 'array'){
            let e = [];
            let exp = getExampleFromSchemaProperty(prop.items, e);
            e.forEach(a=>{
                newSchemaList.push(a);
            });
            return [ exp ];
        }else{
            if(prop.example!==undefined){
                return prop.example;
            }else{
                switch(prop.type){
                    case 'string':
                        return 'string';
                    case 'integer':
                        return 0;
                    case 'number':
                        return 0.0;
                }
            }
        }
    }
}

function getTypeFromSchemaProperty(prop , newSchemaList){
    if(prop["$ref"]){
        let type = prop["$ref"].split("/").pop();
        newSchemaList.push(type);
        return type;
    }else{
        if(prop.type === 'array'){
            let e = [];
            let type = getTypeFromSchemaProperty(prop.items, e);
            if(e.length>0){
                e.forEach(ee=>{
                    newSchemaList.push(ee);
                })
            }
            return `array[${type}]`;
        }else{
            let type = prop.type;
            if(prop.format){
                type += `(${prop.format})`;
            }
            return type;
        }
    }
}

function getInfoFromSchema(schemaName, newSchemaList){
    let propList = [];
    
    for(propName in allSchemas[schemaName].properties){
        let propInfos = allSchemas[schemaName].properties[propName];
        let type = getTypeFromSchemaProperty(propInfos, newSchemaList);
        //let example = propInfos.example
        if(allSchemas[schemaName].required === undefined){
            allSchemas[schemaName].required = [];
        }
        let required = allSchemas[schemaName].required.includes(propName);
        let description = propInfos.description || '';
        propList.push({
            "name": propName,
            "description": description,
            "required": required,
            "type": type
        });

    }
    return propList;
}

function getInfoFromParameters(paramList, newSchemaList){
    paramList.forEach(e=>{
        let type = getTypeFromSchemaProperty(e.schema, newSchemaList);
        e["type"] = type;
        e["description"] = e["description"] || '';
    });
    return paramList;
}


function createBasicInfo(instance, mdOutList) {
    if (instance === undefined || instance === null) {
        instance = {};
    }
    if(instance.info === undefined ){ instance.info={};}
    mdOutList.push('# ' + instance.info.title);
    mdOutList.push("\n");
    mdOutList.push('**简介**:' +  (instance.info.description || ''));
    mdOutList.push("\n");
    mdOutList.push('**Version**:' + (instance.info.version || ''));
    mdOutList.push("\n");

    if(instance.info.contact!==undefined){
        if(instance.info.contact.name){
           mdOutList.push('**联系人姓名**:' + instance.info.contact.name);
            mdOutList.push("\n"); 
        }
        if(instance.info.contact.email){
            mdOutList.push('**联系人邮箱**:' + instance.info.contact.email);
            mdOutList.push("\n");
        }
        if(instance.info.contact.url){
            mdOutList.push('**联系人URL**:' + instance.info.contact.url);
            mdOutList.push("\n");
        }
    }
    mdOutList.push('**服务器**:');
    instance.servers.forEach(e=>{
        mdOutList.push(`- [${e.url}](${e.url}) ${e.description}`);
    })
    mdOutList.push("\n");
    
    //第三方md软件Typora目录格式
    mdOutList.push('[TOC]');
    mdOutList.push("\n");
}


/**
 * 遍历tags分组信息
 * @param {*} instance  当前分组实例对象
 * @param {*} mdOutList markdown文本集合对象 
 */
function createTagsInfo(instance, mdOutList) {
    if(instance.paths === undefined || instance.paths === null){
        return;
    }

    //查找所有Tags
    tagsMap = {};

    //从根目录的tags对象中找
    if (instance.tags != undefined && instance.tags != null) {
        mdOutList.push('\n');
        tagsMap = {};
        instance.tags.forEach(tag => {
            tagsMap[tag.name] = { paths: [], description: tag.description || '' }
        });
    }
    //没有description的tags没有在根目录的tags下存储，手动扫描一下。
    for(path in instance.paths){
        for(method in instance.paths[path]){
            currentMethod = instance.paths[path][method];
            if(currentMethod.tags && currentMethod.tags instanceof Array){
                currentMethod.tags.forEach(tag=>{
                    thisApi = currentMethod;
                    thisApi["method"] = method.toUpperCase();
                    thisApi["path"] = path;
                    if(tagsMap[tag]=== undefined){
                        tagsMap[tag] = { paths: [], description: ''};
                    }
                    tagsMap[tag].paths.push(thisApi);
                })
            }
        }
    }

    for(tagName in tagsMap){
        mdOutList.push("\n");
        mdOutList.push('# ' + tagName);
        mdOutList.push(tagsMap[tagName].description)
        mdOutList.push("\n");
        if(tagsMap[tagName].paths.length>0){
            tagsMap[tagName].paths.forEach(path=>{
                createApiInfo(path, mdOutList);
            });
        }else{
            mdOutList.push('暂无接口文档')
        }
    }
}

/**
 * 遍历接口详情
 * @param {*} apiInfo 接口实例
 * @param {*} mdOutList markdown文本集合对象
 */
function createApiInfo(apiInfo, mdOutList) {
    //二级标题
    mdOutList.push("\n");
    mdOutList.push('## ' + (apiInfo.summary || apiInfo.operationId));
    mdOutList.push("\n");
    mdOutList.push("### 基本信息");
    mdOutList.push('**接口地址**:`' + apiInfo.path + '`');
    mdOutList.push("\n");
    mdOutList.push('**请求方式**:`' + apiInfo.method + '`');
    mdOutList.push("\n");
    //mdOutList.push('**请求数据类型**:`' + (apiInfo.consumes === undefined ? '*' : apiInfo.consumes) + '`');
    //mdOutList.push("\n");
    mdOutList.push('**响应数据类型**:`' + (apiInfo.produces === undefined ? '*' : apiInfo.produces) + '`');
    mdOutList.push("\n");
    mdOutList.push('**接口描述**:' + (apiInfo.description === undefined ? '暂无' : apiInfo.description) + '');
    //请求参数
    createApiRequestParameters(apiInfo, mdOutList);
    //响应状态
    createApiResponseParameters(apiInfo, mdOutList);

}


/**
 * 响应参数
 * @param {*} apiInfo 
 * @param {*} mdOutList 
 * @param {*} singleFlag 
 */
function createApiResponseParameters(apiInfo, mdOutList) {
    //判断是否多个schema
    let newSchema = [];
    mdOutList.push("### 响应说明\n");
    mdOutList.push('| 状态码 | 说明 | 参数类型 |');
    mdOutList.push('| ---- | ---- | ----- |');
    let firstType = null;
    for(let code in apiInfo.responses){
        let res = apiInfo.responses[code];
        let desc = res.description || '';
        let content = res.content;
        let type = '';
        for(let mime in content){
            let mimeObj = content[mime];
            let schema = mimeObj.schema;
            type = getTypeFromSchemaProperty(schema, newSchema);
            if(firstType === null) { firstType = type; }
            break;
        }
        mdOutList.push(`| ${code} | ${desc} | ${type} |`);
    }
    mdOutList.push("\n");

    mdOutList.push("**响应示例**");
    let exp = getSchemaExample(firstType);
    mdOutList.push("```json");
    mdOutList.push(exp);
    mdOutList.push("```");
    mdOutList.push("\n");


    mdOutList.push("**类型属性说明**");
    while(newSchema.length>0){
        let newList = [];
        newSchema.forEach(schemaName=>{
            let apiDesc = allSchemas[schemaName].description || '';
            mdOutList.push(`**${schemaName}** ` + apiDesc );
            let infoList = getInfoFromSchema(schemaName, newList);
            infoList.forEach(e=> e.in = "query");
            mdOutList.push('| 参数名称 | 参数说明 | 数据类型 |');
            mdOutList.push('| ----- | ------ | ------ |');
            let infos = infoList;
            infos.forEach(info=>{
                mdOutList.push(`| ${info.name} | ${info.description} | ${info.type} |`)
            });
            mdOutList.push("\n");
        });
        newSchema = newList;

    }

}


function createApiRequestParameters(apiInfo, mdOutList) {

    let reqParameters = apiInfo.parameters;
    mdOutList.push("\n");
    mdOutList.push('### 请求参数');
    //判断是否拥有请求参数
    if ((reqParameters !== undefined) && (reqParameters instanceof Array) && (reqParameters.length > 0)) {
        let out = [];
        {
            let infos = getInfoFromParameters(reqParameters, out);
            mdOutList.push('| 参数名称 | 参数说明 | in | 是否必须 | 数据类型 |');
            mdOutList.push('| ----- | ------ | ----- | ----- | ------ |');
            if(infos.length===1 && out.length === 1){  // 只有一个查询参数，且为实体类，则直接展开
                schemaName = out[0];
                out = [];
                let infoList = getInfoFromSchema(schemaName, out);
                infoList.forEach(e=> e.in = "query");
                let infos = infoList;
                infos.forEach(info=>{
                    mdOutList.push(`| ${info.name} | ${info.description} | ${info.in} | ${info.required} | ${info.type} |`)
                });
                mdOutList.push("\n");
            }else{
                infos.forEach(info=>{
                    mdOutList.push(`| ${info.name} | ${info.description} | ${info.in} | ${info.required} | ${info.type} |`)
                });
                mdOutList.push("\n");
            }
            
        }
        if(out.length>0 ) { mdOutList.push("**类型属性说明**");}
        while(out.length>0){
            let newList = [];
            out.forEach(schemaName=>{
                let apiDesc = allSchemas[schemaName].description || '';
                mdOutList.push(`**${schemaName}** ` + apiDesc );
                let infoList = getInfoFromSchema(schemaName, newList);
                infoList.forEach(e=> e.in = "query");
                mdOutList.push('| 参数名称 | 参数说明 | in | 是否必须 | 数据类型 |');
                mdOutList.push('| ----- | ------ | ----- | ----- | ------ |');
                let infos = infoList;
                infos.forEach(info=>{
                    mdOutList.push(`| ${info.name} | ${info.description} | ${info.in} | ${info.required} | ${info.type} |`)
                });
                mdOutList.push("\n");
            });
            out = newList;
        }
        
    }else if(apiInfo.requestBody) {
        let content = apiInfo.requestBody.content;
        let e = [];
        for(let mime in content){
            let mimeObj = content[mime];
            let type = getTypeFromSchemaProperty(mimeObj.schema,e);
            if(e.length==0){
                mdOutList.push("请求体参数类型: `"+ type+"`");
                mdOutList.push("\n");
            }else{
                e = [];
                let infos = getInfoFromSchema(type, e);
                infos.forEach(a=>a.in="body");
                mdOutList.push('| 参数名称 | 参数说明 | in | 是否必须 | 数据类型 |');
                mdOutList.push('| ----- | ------ | ----- | ----- | ------ |');
                infos.forEach(info=>{
                    mdOutList.push(`| ${info.name} | ${info.description} | ${info.in} | ${info.required} | ${info.type} |`)
                });
                mdOutList.push("\n");

                let out = e;
                if(out.length>0 ) { mdOutList.push("**类型属性说明**");}
                while(out.length>0){
                    let newList = [];
                    out.forEach(schemaName=>{
                        let apiDesc = allSchemas[schemaName].description || '';
                        mdOutList.push(`**${schemaName}** ` + apiDesc );
                        let infoList = getInfoFromSchema(schemaName, newList);
                        infoList.forEach(e=> e.in = "body");
                        mdOutList.push('| 参数名称 | 参数说明 | in | 是否必须 | 数据类型 |');
                        mdOutList.push('| ----- | ------ | ----- | ----- | ------ |');
                        let infos = infoList;
                        infos.forEach(info=>{
                            mdOutList.push(`| ${info.name} | ${info.description} | ${info.in} | ${info.required} | ${info.type} |`)
                        });
                        mdOutList.push("\n");
                    });
                    out = newList;
                }

            }
            mdOutList.push("**请求示例**");
            let exp = getSchemaExample(type);
            mdOutList.push("```json");
            mdOutList.push(exp);
            mdOutList.push("```");
            mdOutList.push("\n");

            break;
        }
    }else {
        mdOutList.push("\n");
        mdOutList.push('暂无');
    }
    mdOutList.push("\n");
}



// main
const argv = process.argv;
if(argv.length!=4){
    console.log("Usage: \n    "+ argv[0]+ " "+ argv[1] + " input_json_file output_markdown_file \n");
}else{
    json = fs.readFileSync(argv[2]);
    out = markdownText(JSON.parse(json))
    fs.writeFileSync(argv[3], out)
}
