import { ObjectId } from "bson"
export const shapeIntoMOngoObjectId=(target:any)=>{
    return typeof target ==='string'? new ObjectId(target):target


}