const Task = require("../models/Task")
const mongoose = require('mongoose');
const User = require("../models/User")



//@desc Get all task(admin:all, user:assigned)
//@route GET /api/tasks/
//@access Private
const getTasks = async (req,res)=>{
    try{
         const {status} = req.query;
            let filter = {}

          if(status){
              filter.status = status
          }

          let tasks;
          if(req.user.role === "admin"){
              tasks = await Task.find(filter).populate("assignedTo","name email profileImageUrl");
          }else{
              tasks = await Task.find({...filter, assignedTo:req.user._id}).populate("assignedTo","name email profileImageUrl")
          }
          tasks = await Promise.all(tasks.map(async (task)=>{
              const completedCount = task.todoChecklist.filter(item=>item.completed).length;
              return {...task._doc, completedTodoCount : completedCount}
          }))
          
          //Status summary counts
          const allTasks = await Task.countDocuments(
                 req.user.role === "admin" ? {} : { assignedTo: req.user._id }
          )
          const pendingTasks = await Task.countDocuments({
              ...filter,
              status: "Pending",
              ...(req.user.role !== "admin"  && {assignedTo: req.user._id})
          })
          const inProgressTasks = await Task.countDocuments({
              ...filter,
              status: "In Progress",
              ...(req.user.role !== "admin" && { assignedTo: req.user._id })
          })
          const completedTasks = await Task.countDocuments({
              ...filter,
              status: "Completed",
              ...(req.user.role !== "admin" && { assignedTo: req.user._id })
          })
          res.json({
              tasks,
              statusSummary: {
                  all: allTasks,
                  completedTasks,
                  inProgressTasks,
                  pendingTasks
              }
          })
    }catch(error){
        res.status(500).json({message:"Server Error", error:error.message})
    }
}


//@desc Get task by id
//@route Get /api/tasks/:id
//@access Router    
const getTaskById = async (req,res) =>{
      try{

        const task = await Task.findById(req.params.id).populate("assignedTo","name email profileImageUrl");
        if(!task) return res.status(404).json({message:"Task not found"})
        
        res.json(task)

    }catch(error){
        res.status(500).json({message:"Server Error", error:error.message})
    }
}


//@desc create a new task (admin only)
//@route POSt /api/tasks
//@access Private(admin)
const createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, priority, attachments, todoChecklist } = req.body;
    
    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }
    
    if (!dueDate) {
      return res.status(400).json({ message: "Due date is required" });
    }
    
    if (!Array.isArray(assignedTo)) {
      return res.status(400).json({ message: "assignedTo must be an array of user IDs" });
    }

    // Validate assignedTo contains valid ObjectIds
    if (assignedTo.length > 0) {
      for (const userId of assignedTo) {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          return res.status(400).json({ message: `Invalid user ID: ${userId}` });
        }
      }
    }

    // Create the task
    const task = await Task.create({
      title: title.trim(),
      description: description?.trim() || "",
      priority: priority || "Low",
      dueDate: new Date(dueDate),
      assignedTo,
      createdBy: req.user._id,
      todoChecklist: todoChecklist || [],
      attachments: attachments || []
    });

    console.log('Task created successfully:', task._id);
    
    res.status(201).json({
      message: "Task created successfully",
      task: task
    });

  } catch (error) {
    console.error('Error creating task:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: "Validation Error",
        errors: errors
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Task with this title already exists"
      });
    }
    
    res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};


//@desc  update task details
//@route PUT /api/tasks/:id
//@access Private
const updateTask = async(req,res)=>{
      try{

        const task = await Task.findById(req.params.id);
        if(!task) return res.status(404).json({message:"Task not found"})

        task.title = req.body.title || task.title;
        task.description = req.body.description || task.description;
        task.priority = req.body.priority || task.priority;
        task.dueDate = req.body.dueDate || task.dueDate;
        task.todoChecklist = req.body.todoChecklist || task.todoChecklist;
        task.attachments = req.body.attachments || task.attachments;

        if(req.body.assignedTo){
            if(!Array.isArray(req.body.assignedTo)){
                return res.status(400).json({message:"assignedTo must be an array of user IDs"})
            }
            task.assignedTo = req.body.assignedTo;
        }

        const updatedTask = await task.save();
        res.json({message:"Task updated successfully", updatedTask})

    }catch(error){
        res.status(500).json({message:"Server Error", error:error.message})
    }
}


//@desc delete a task(admin only)
//@route DELETE /api/tasks/:id
//@acces Private
const deleteTask = async (req,res)=>{
      try{
          const task = await Task.findById(req.params.id);
          if(!task) return res.status(404).json({message:"Task not found"})

          await task.deleteOne();
          res.json({message:"Task Deleted Successfully"})
    }catch(error){
        res.status(500).json({message:"Server Error", error:error.message})
    }
}


//@desc update task status
//@route PUT /pi/tasks/:id/status
//@access Private

//there may be an error b/c of assignedTo
// In your backend task controller
//@desc update task status
//@route PUT /api/tasks/:id/status
//@access Private
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params; // FIXED: Use 'id' instead of 'taskId'
    const { status } = req.body;

    // Validate status
    const validStatuses = ['Pending', 'In Progress', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const task = await Task.findByIdAndUpdate(
      id, // FIXED: Use 'id' here too
      { status },
      { new: true }
    ).populate('assignedTo', 'name profileImageUrl email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      message: 'Task status updated successfully',
      task
    });

  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

//@route PUT /api/tasks/:id/todo
const updateTaskChecklist = async(req,res)=>{
      try{

        const {todoChecklist} = req.body;
        const task = await Task.findById(req.params.id)

        if(!task) return res.status(404).json({message:"Task not found"})

        if(!task.assignedTo.includes(req.user._id) && req.user.role !=="admin"){
            return res.status(403).json({message:"Not Authorized to update checklist"})
        }

        task.todoChecklist = todoChecklist; //replace with updated checklist

        //Auto-update progress based on checklist completion
        const completedCount = todoChecklist.filter(item=>item.completed).length;
        const totalItems = task.todoChecklist.length;
        task.progress = totalItems >0 ? Math.round((completedCount/totalItems)*100) : 0;
        if(task.progress === 100){
            task.status = "Completed"
        }else if(task.progress >0){
            task.status = "In Progress"
        }else{
            task.status = "Pending"
        }

        await task.save()
        const updatedTask = await Task.findById(req.params.id).populate(
            "assignedTo", "name email profileImageUrl"
        )
        res.json({message:"Task Checklist updated",task: updatedTask});

    }catch(error){
        res.status(500).json({message:"Server Error", error:error.message})
    }
}


//@route get /api/tasks/dashboard-data
//@route get /api/tasks/dashboard-data
const getDashboardData = async(req,res)=>{
      try{

        const totalTasks = await Task.countDocuments();
        const completedTasks = await Task.countDocuments({status:"Completed"});
        const pendingTasks = await Task.countDocuments({status:"Pending"});
        const overdueTasks = await Task.countDocuments({
            status :{$ne:"Completed"},
            dueDate : {$lt:new Date()}
        });
        const taskStatuses = ["Pending","In Progress", "Completed"]
        const taskDistributionRaw = await Task.aggregate([
            {
                $group :{
                    _id:"$status",
                    count: {$sum:1}
                }
            }
        ])

        const taskDistribution = taskStatuses.reduce((acc,status)=>{
            const formattedKey = status.replace(/\s+/g,""); //remove spaces from responses keys
            acc[formattedKey] = taskDistributionRaw.find((item)=>item._id ===status) ?.count||0;
            return acc
        },{});

        taskDistribution["All"] = totalTasks; //Add total count to taskDistribution

        //ensure all priority levels are included
        const taskPriorities = ["Low","Medium","High"];
        const taskPriorityLevelsRaw = await Task.aggregate([
            {
                $group: { _id :"$priority",
                count : {$sum:1}
            }
           }
        ])

        const taskPriorityLevels = taskPriorities.reduce((acc,priority)=>{
            acc[priority]= taskPriorityLevelsRaw.find((item)=> item._id=== priority)?.count || 0;
            return acc;
        },{})


        //fetch recent 10 tasks - FIXED: changed "little" to "title"
        const recentTasks = await Task.find().sort({createdAt:-1}).limit(10).select("title status priority dueDate createdAt")
 
        res.status(200).json({
            statistics :{
                totalTasks, pendingTasks, completedTasks, overdueTasks,
            },
            charts:{
                taskDistribution, taskPriorityLevels,
            },
            recentTasks,
        });

    }catch(error){
        res.status(500).json({message:"Server Error", error:error.message})
    }
}


//@route GET /api/tasks/user-dashboard-data
//@route GET /api/tasks/user-dashboard-data
const getUserDashboardData = async (req, res) => {
  try {
    console.log('🔍 getUserDashboardData called for user:', req.user._id);
    
    const userId = req.user._id;
    
    // Basic task counts
    const totalTasks = await Task.countDocuments({ assignedTo: userId });
    const completedTasks = await Task.countDocuments({ assignedTo: userId, status: "Completed" });
    const pendingTasks = await Task.countDocuments({ assignedTo: userId, status: "Pending" });
    const overdueTasks = await Task.countDocuments({
      assignedTo: userId,
      status: { $ne: "Completed" },
      dueDate: { $lt: new Date() }
    });

    console.log('📊 Task counts:', { totalTasks, completedTasks, pendingTasks, overdueTasks });

    // Task distribution
    const taskStatuses = ["Pending", "In Progress", "Completed"];
    const taskDistributionRaw = await Task.aggregate([
      { $match: { assignedTo: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('📈 Task distribution raw:', taskDistributionRaw);

    const taskDistribution = taskStatuses.reduce((acc, status) => {
      const formattedKey = status.replace(/\s+/g, "");
      acc[formattedKey] = taskDistributionRaw.find((item) => item._id === status)?.count || 0;
      return acc;
    }, {});

    taskDistribution["All"] = totalTasks;

    // Priority levels
    const taskPriorities = ["Low", "Medium", "High"];
    const taskPriorityLevelsRaw = await Task.aggregate([
      { $match: { assignedTo: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('🎯 Priority levels raw:', taskPriorityLevelsRaw);

    const taskPriorityLevels = taskPriorities.reduce((acc, priority) => {
      acc[priority] = taskPriorityLevelsRaw.find((item) => item._id === priority)?.count || 0;
      return acc;
    }, {});

    // Recent tasks
    const recentTasks = await Task.find({ assignedTo: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title status priority dueDate createdAt")
      .populate('assignedTo', 'name email profileImageUrl');

    console.log('📝 Recent tasks count:', recentTasks.length);

    // Productivity score
    const productivityScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Tasks due this week
    const startOfWeek = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    
    const dueThisWeek = await Task.countDocuments({
      assignedTo: userId,
      dueDate: { $gte: startOfWeek, $lte: endOfWeek },
      status: { $ne: "Completed" }
    });

    // Team members count - handle potential errors
    let teamMembersCount = 0;
    try {
      teamMembersCount = await User.countDocuments({ _id: { $ne: userId } });
    } catch (userError) {
      console.warn('⚠️ Could not count team members:', userError.message);
      teamMembersCount = 0;
    }

    console.log('✅ Dashboard data prepared successfully');

    const responseData = {
      productivityScore,
      statistics: {
        totalTasks,
        pendingTasks,
        completedTasks,
        overdueTasks,
      },
      charts: {
        taskDistribution,
        taskPriorityLevels,
      },
      quickStats: {
        overdue: overdueTasks,
        dueThisWeek,
        teamMembers: teamMembersCount
      },
      recentTasks,
    };

    console.log('📤 Sending response:', responseData);
    
    res.status(200).json(responseData);
    
  } catch (error) {
    console.error("❌ Error in getUserDashboardData:", error);
    console.error("🔍 Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      message: "Server Error in getUserDashboardData", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
// In your task controller
const getAllTasks = async (req, res) => {
  try {
    const { status } = req.query;
    
    // Build filter object
    let filter = {};
    if (status && status !== 'All') {
      filter.status = status;
    }

    // Get tasks with populated data
    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name profileImageUrl email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Get status counts
    const allCount = await Task.countDocuments();
    const pendingCount = await Task.countDocuments({ status: 'Pending' });
    const inProgressCount = await Task.countDocuments({ status: 'In Progress' });
    const completedCount = await Task.countDocuments({ status: 'Completed' });

    res.status(200).json({
      success: true,
      tasks,
      statusSummary: {
        all: allCount,
        pending: pendingCount,
        inProgress: inProgressCount,
        completed: completedCount
      }
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


//@desc Get user's assigned tasks
//@route GET /api/tasks/my-tasks
//@access Private
const getUserTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const tasks = await Task.find({ 
      assignedTo: { $in: [new mongoose.Types.ObjectId(userId)] }
    })
    .populate('assignedTo', 'name email profileImageUrl')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      tasks: tasks,
      count: tasks.length,
      message: 'User tasks fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching user tasks', 
      error: error.message 
    });
  }
};


module.exports = {
  getUserTasks,
    getAllTasks,
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    updateTaskChecklist,
    getDashboardData,
    getUserDashboardData
}