const Task = require("../models/Task")
const User = require("../models/User")
const bcrypt = require("bcryptjs")

//@desc Get all User(admin only)
//@route Get /api/users/
//@access Private {Admin}
const getUsers = async (req,res)=>{
    try{

        const users = await User.find({role:"member"}).select("-password");

        //Add task counts to each user
        const usersWithTaskCounts = await Promise.all(users.map(async(user)=>{
             const pendingTasks = await Task.countDocuments({assignedTo:user._id,status:"Pending"})
             const inProgressTasks = await Task.countDocuments({assignedTo:user._id,status:"In Progress"})
             const completedTasks = await Task.countDocuments({assignedTo:user._id,status:"Completed"})

             return {
                ...user._doc, //include all existing user data
                pendingTasks,
                inProgressTasks,
                completedTasks,
             }
        }))
        res.json(usersWithTaskCounts)

    }catch(error){
        res.status(500).json({message:"Server Error",error:error.message})
    }
}

//@desc get user by id
//@route Get /api/users/:id
//@access Private
const getUserById = async (req,res)=>{
    try{
        const user = await User.findById(req.params.id).select("-password");
        if(!user) return res.status(404).json({message:"User Not Found"})
        res.json(user)
    }catch(error){
        res.status(500).json({message:"Server Error",error:error.message})
    }
}


//@desc Delete a user(Admin Only)
//@route DELETE /api/users/:id
//@access Private(admin)
// const deleteUser = async (req,res)=>{
//       try{

//     }catch(error){
//         res.status(500).json({message:"Server Error",error:error.message})
//     }
// }

module.exports = { getUsers, getUserById}